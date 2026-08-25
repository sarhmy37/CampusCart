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

// ---- Config ----
const RP_NAME = 'Tre-X';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

console.log('✅ WebAuthn Routes Loaded');
console.log('   RP_ID:', RP_ID);
console.log('   ORIGIN:', ORIGIN);

// Temp challenge store. Swap for Redis in production.
const challengeStore = new Map();

// =========================================================
// CHECK - if user has a passkey
// =========================================================
router.get('/webauthn/check', requireAuth, async (req, res) => {
    try {
        console.log('🔍 Check passkey for user:', req.userId);
        const result = await pool.query(
            'SELECT id FROM webauthn_credentials WHERE user_id = $1 LIMIT 1',
            [req.userId]
        );
        res.json({ hasPasskey: result.rows.length > 0 });
    } catch (err) {
        console.error('❌ Check passkey error:', err);
        res.status(500).json({ error: 'Failed to check passkey status' });
    }
});

// =========================================================
// REGISTRATION — user is already logged in
// =========================================================
router.post('/webauthn/register-options', requireAuth, async (req, res) => {
    const userId = req.userId;
    console.log('📝 Register options for user:', userId);

    try {
        // Get user details for display name
        const userRes = await pool.query(
            'SELECT id, name, university_email FROM users WHERE id = $1',
            [userId]
        );
        
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userRes.rows[0];

        const existingCreds = await pool.query(
            'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1',
            [userId]
        );

        console.log('🔑 Generating registration options...');
        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userID: isoUint8Array.fromUTF8String(String(userId)),
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

        console.log('✅ Registration options generated');
        challengeStore.set(`reg:${userId}`, options.challenge);
        res.json(options);
    } catch (err) {
        console.error('❌ Register options error:', err);
        res.status(500).json({ error: 'Failed to generate registration options' });
    }
});

router.post('/webauthn/register-verify', requireAuth, async (req, res) => {
    const userId = req.userId;
    console.log('🔐 Register verify for user:', userId);
    
    const expectedChallenge = challengeStore.get(`reg:${userId}`);

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
        console.error('❌ WebAuthn registration verify failed:', err);
        return res.status(400).json({ error: 'Could not verify device' });
    }

    challengeStore.delete(`reg:${userId}`);

    if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'Verification failed' });
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    try {
        await pool.query(
            `INSERT INTO webauthn_credentials
             (user_id, credential_id, public_key, counter, device_type, transports)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                userId,
                credential.id,
                Buffer.from(credential.publicKey),
                credential.counter,
                credentialDeviceType,
                req.body.response?.transports || [],
            ]
        );
        console.log('✅ Credential saved successfully!');
        res.json({ verified: true });
    } catch (err) {
        console.error('❌ Failed to save credential:', err);
        res.status(500).json({ error: 'Failed to save credential' });
    }
});

// =========================================================
// LOGIN — user is NOT authenticated yet (NO EMAIL REQUIRED!)
// =========================================================
router.post('/webauthn/login-options', async (req, res) => {
    try {
        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: 'required',
        });

        const loginToken = isoBase64URL.fromUTF8String(`${Date.now()}:${Math.random()}`);
        challengeStore.set(`login:${loginToken}`, { challenge: options.challenge });

        res.json({ options, loginToken });
    } catch (err) {
        console.error('❌ WebAuthn login options error:', err);
        res.status(500).json({ error: 'Failed to initialize Face ID login' });
    }
});

router.post('/webauthn/login-verify', async (req, res) => {
    const { loginToken, response } = req.body;
    const stored = challengeStore.get(`login:${loginToken}`);

    if (!stored) {
        return res.status(400).json({ error: 'Login session expired, try again' });
    }

    // Find the credential in the database by credential_id (no userId needed)
    const credRes = await pool.query(
        'SELECT * FROM webauthn_credentials WHERE credential_id = $1',
        [response.id]
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
        console.error('❌ WebAuthn login verify failed:', err);
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

    // Get user info using the userId from the credential
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [savedCred.user_id]);
    const user = userRes.rows[0];

    if (!user) {
        return res.status(400).json({ error: 'User not found' });
    }

    // Generate JWT token
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

module.exports = router;