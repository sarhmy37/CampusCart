const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/support — submit a support request
router.post('/', requireAuth, async (req, res) => {
    const { message } = req.body;
    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Please enter a message' });
    }

    try {
        await pool.query(
            'INSERT INTO support_requests (user_id, message) VALUES ($1, $2)',
            [req.userId, message.trim()]
        );
        res.status(201).json({ message: 'Support request submitted' });
    } catch (err) {
        console.error('Create support request error:', err);
        res.status(500).json({ error: 'Something went wrong submitting your request' });
    }
});

module.exports = router;