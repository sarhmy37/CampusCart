const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const router = express.Router();

// POST /api/admin/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    try {
        // Admin needs a real row in `users` so its UUID works with every
        // foreign key in the app (conversations, notifications, etc).
        // Find it, or create it once on first login.
        let result = await pool.query(
            `SELECT id, name, university_email, role, account_type, verified
             FROM users WHERE university_email = $1`,
            [email]
        );

        let adminUser;
        if (result.rows.length > 0) {
            adminUser = result.rows[0];
            if (adminUser.role !== 'admin') {
                await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminUser.id]);
                adminUser.role = 'admin';
            }
        } else {
            const inserted = await pool.query(
                `INSERT INTO users (name, university_email, password_hash, account_type, role, verified)
                 VALUES ($1, $2, $3, 'buyer', 'admin', true)
                 RETURNING id, name, university_email, role, account_type, verified`,
                ['Admin', email, 'not-used-admin-authenticates-via-env-credentials']
            );
            adminUser = inserted.rows[0];
        }

        const token = jwt.sign({ userId: adminUser.id, role: 'admin' }, process.env.JWT_SECRET, {
            expiresIn: '7d',
        });

        res.json({
            token,
            user: {
                id: adminUser.id,
                name: adminUser.name,
                university_email: adminUser.university_email,
                role: 'admin',
                account_type: adminUser.account_type,
                verified: true,
            },
        });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ error: 'Something went wrong logging in' });
    }
});

module.exports = router;