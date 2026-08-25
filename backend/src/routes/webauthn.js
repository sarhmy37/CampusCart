const express = require('express');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { isoUint8Array, isoBase64URL } = require('@simplewebauthn/server/helpers');
const { requireAuth } = require('../middleware/auth');
const pool = require('../db/pool');

const router = express.Router();

// ---- Config: change these for your real domain in production ----
const RP_NAME = 'Tre-X';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

// Temp challenge store. Swap for Redis in production.
const challengeStore = new Map();

// =========================================================
// REGISTRATION — user is already logged in
// =========================================================

router.post('/webauthn/register-options', requireAuth, async (req, res) => {
    const user = req.user;

    const existingCreds = await pool.query(
        'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1',
        [user.id]
    );

    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: isoUint8Array.fromUTF8String(String(user.id)),
        userName: user.university_email,
        userDisplayName: user.name,
        attestationType: 'none',
        excludeCredentials: existingCreds.rows.map((c) => ({
            id: c.credential_id,
            transports: c.transports,
        })),
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'required',
            authenticatorAttachment: 'platform',
        },
    });

    challengeStore.set(`reg:${user.id}`, options.challenge);
    res.json(options);
});

router.post('/webauthn/register-verify', requireAuth, async (req, res) => {
    const user = req.user;
    const expectedChallenge = challengeStore.get(`reg:${user.id}`);

    if (!expectedChallenge) {
        return res.status(400).json({ error: 'Registration session expired, try again' });
    }

    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: req.body,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
        });
    } catch (err) {
        console.error('WebAuthn registration verify failed:', err);
        return res.status(400).json({ error: 'Could not verify device' });
    }

    challengeStore.delete(`reg:${user.id}`);

    if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'Verification failed' });
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    await pool.query(
        `INSERT INTO webauthn_credentials
         (user_id, credential_id, public_key, counter, device_type, transports)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            user.id,
            credential.id,
            Buffer.from(credential.publicKey),
            credential.counter,
            credentialDeviceType,
            req.body.response?.transports || [],
        ]
    );

    res.json({ verified: true });
});

// =========================================================
// LOGIN — user is NOT authenticated yet
// =========================================================

router.post('/webauthn/login-options', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const userRes = await pool.query(
        'SELECT id FROM users WHERE university_email = $1',
        [email]
    );
    if (userRes.rows.length === 0) {
        return res.status(400).json({ error: 'No passkey found for this account' });
    }
    const userId = userRes.rows[0].id;

    const credsRes = await pool.query(
        'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1',
        [userId]
    );
    if (credsRes.rows.length === 0) {
        return res.status(400).json({ error: 'No passkey registered for this account' });
    }

    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: 'required',
        allowCredentials: credsRes.rows.map((c) => ({
            id: c.credential_id,
            transports: c.transports,
        })),
    });

    const loginToken = isoBase64URL.fromUTF8String(`${userId}:${Date.now()}:${Math.random()}`);
    challengeStore.set(`login:${loginToken}`, { challenge: options.challenge, userId });

    res.json({ options, loginToken });
});

router.post('/webauthn/login-verify', async (req, res) => {
    const { loginToken, response } = req.body;
    const stored = challengeStore.get(`login:${loginToken}`);

    if (!stored) {
        return res.status(400).json({ error: 'Login session expired, try again' });
    }

    const credRes = await pool.query(
        'SELECT * FROM webauthn_credentials WHERE credential_id = $1 AND user_id = $2',
        [response.id, stored.userId]
    );
    if (credRes.rows.length === 0) {
        return res.status(400).json({ error: 'Credential not recognized' });
    }
    const savedCred = credRes.rows[0];

    let verification;
    try {
        verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: stored.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            credential: {
                id: savedCred.credential_id,
                publicKey: savedCred.public_key,
                counter: Number(savedCred.counter),
                transports: savedCred.transports,
            },
        });
    } catch (err) {
        console.error('WebAuthn login verify failed:', err);
        return res.status(400).json({ error: 'Could not verify' });
    }

    challengeStore.delete(`login:${loginToken}`);

    if (!verification.verified) {
        return res.status(400).json({ error: 'Verification failed' });
    }

    await pool.query(
        'UPDATE webauthn_credentials SET counter = $1, last_used_at = NOW() WHERE id = $2',
        [verification.authenticationInfo.newCounter, savedCred.id]
    );

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [stored.userId]);
    const user = userRes.rows[0];

    // Generate JWT token (same as your login route)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    res.json({
        token,
        user: {
            id: user.id,
            name: user.name,
            university_email: user.university_email,
            school: user.school,
            account_type: user.account_type,
            role: user.role,
            verified: user.verified,
            avatar_url: user.avatar_url,
        },
    });
});

// GET /api/auth/webauthn/check — check if user has a passkey
router.get('/webauthn/check', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id FROM webauthn_credentials WHERE user_id = $1 LIMIT 1',
            [req.user.id]
        );
        res.json({ hasPasskey: result.rows.length > 0 });
    } catch (err) {
        console.error('Check passkey error:', err);
        res.status(500).json({ error: 'Failed to check passkey status' });
    }
});

// POST /api/auth/webauthn/login-options-no-email — login without typing email
router.post('/webauthn/login-options', async (req, res) => {
    try {
        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: 'required',
            // No allowCredentials = webauthn will ask the user which credential to use
            // (supports "discoverable credentials")
        });

        const loginToken = isoBase64URL.fromUTF8String(`${Date.now()}:${Math.random()}`);
        challengeStore.set(`login:${loginToken}`, { challenge: options.challenge });

        res.json({ options, loginToken });
    } catch (err) {
        console.error('WebAuthn login options error:', err);
        res.status(500).json({ error: 'Failed to initialize Face ID login' });
    }
});

module.exports = router;