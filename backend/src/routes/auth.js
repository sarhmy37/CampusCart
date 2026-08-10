const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const { sendVerificationEmail } = require('../utils/mailer');

const router = express.Router();

function signToken(user) {
    return jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
}

function toPublicUser(row) {
    return {
        id: row.id,
        name: row.name,
        university_email: row.university_email,
        school: row.school,
        account_type: row.account_type,
        role: row.role,
        verified: row.verified,
        avatar_url: row.avatar_url,
        about: row.about,
        personal_email: row.personal_email,
        whatsapp: row.whatsapp,
        location: row.location,
    };
}

function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}


// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, university_email, password, school, account_type, whatsapp, location } = req.body;

    if (!name || !university_email || !password) {
        return res.status(400).json({ error: 'Name, university email, and password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!whatsapp) {
        return res.status(400).json({ error: 'WhatsApp number is required' });
    }

    const resolvedAccountType = account_type === 'seller' ? 'seller' : 'buyer';

    if (resolvedAccountType === 'buyer' && !location) {
        return res.status(400).json({ error: 'Delivery location is required for buyer accounts' });
    }

    try {
        const existing = await pool.query('SELECT id FROM users WHERE university_email = $1', [university_email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (name, university_email, password_hash, school, account_type, whatsapp, location)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, university_email, passwordHash, school || null, resolvedAccountType, whatsapp, location || null]
        );

        const user = result.rows[0];
        const token = signToken(user);
        res.status(201).json({ token, user: toPublicUser(user) });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Something went wrong creating your account' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { university_email, password } = req.body;

    if (!university_email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE university_email = $1', [university_email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = signToken(user);
        res.json({ token, user: toPublicUser(user) });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Something went wrong logging in' });
    }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(toPublicUser(user));
    } catch (err) {
        console.error('Get me error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// PATCH /api/auth/me
router.patch('/me', requireAuth, async (req, res) => {
    const { about, personal_email, whatsapp, location, name, school, verified } = req.body;

    try {
        const result = await pool.query(
            `UPDATE users SET
                about = COALESCE($1, about),
                personal_email = COALESCE($2, personal_email),
                whatsapp = COALESCE($3, whatsapp),
                location = COALESCE($4, location),
                name = COALESCE($5, name),
                school = COALESCE($6, school),
                verified = COALESCE($7, verified)
             WHERE id = $8
             RETURNING *`,
            [about, personal_email, whatsapp, location, name, school, verified, req.userId]
        );
        res.json(toPublicUser(result.rows[0]));
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Something went wrong updating your profile' });
    }
});

// POST /api/auth/me/avatar
router.post('/me/avatar', requireAuth, uploadAvatar.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file received' });
    }

    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;

    try {
        const result = await pool.query(
            'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING *',
            [avatarUrl, req.userId]
        );
        res.json(toPublicUser(result.rows[0]));
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Something went wrong uploading your photo' });
    }
});

// PATCH /api/auth/me/password
router.patch('/me/password', requireAuth, async (req, res) => {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
        const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        const match = await bcrypt.compare(current_password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

        const newHash = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.userId]);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Something went wrong updating your password' });
    }
});

// POST /api/auth/me/send-verification
router.post('/me/send-verification', requireAuth, async (req, res) => {
    try {
        const userResult = await pool.query('SELECT university_email, verified FROM users WHERE id = $1', [req.userId]);
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.verified) return res.status(400).json({ error: 'Account is already verified' });

        const code = generateCode();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        await pool.query(
            'UPDATE users SET verification_code = $1, verification_code_expires = $2 WHERE id = $3',
            [code, expires, req.userId]
        );

        await sendVerificationEmail(user.university_email, code);
        res.json({ message: 'Verification code sent' });
    } catch (err) {
        console.error('Send verification error:', err);
        res.status(500).json({ error: 'Something went wrong sending the verification code' });
    }
});

// POST /api/auth/me/verify
router.post('/me/verify', requireAuth, async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    try {
        const result = await pool.query(
            'SELECT verification_code, verification_code_expires FROM users WHERE id = $1',
            [req.userId]
        );
        const user = result.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!user.verification_code || user.verification_code !== code) {
            return res.status(400).json({ error: 'Incorrect code' });
        }
        if (new Date() > new Date(user.verification_code_expires)) {
            return res.status(400).json({ error: 'Code has expired — request a new one' });
        }

        const updated = await pool.query(
            `UPDATE users SET verified = TRUE, verification_code = NULL, verification_code_expires = NULL
             WHERE id = $1 RETURNING *`,
            [req.userId]
        );

        res.json(toPublicUser(updated.rows[0]));
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ error: 'Something went wrong verifying your account' });
    }
});

module.exports = router;