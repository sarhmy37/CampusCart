const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// POST /api/admin/login
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = jwt.sign({ userId: 'admin', role: 'admin' }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });

    res.json({
        token,
        user: {
            id: 'admin',
            name: 'Admin',
            university_email: process.env.ADMIN_EMAIL,
            role: 'admin',
            account_type: 'admin',
            verified: true,
        },
    });
});

module.exports = router;