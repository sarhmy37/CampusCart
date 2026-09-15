const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { insertNotification } = require('../utils/notifications');

const router = express.Router();

// POST /api/support — submit a support request
router.post('/', requireAuth, async (req, res) => {
    const { message } = req.body;
    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Please enter a message' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO support_requests (user_id, message) VALUES ($1, $2) RETURNING id',
            [req.userId, message.trim()]
        );

        const planRes = await pool.query(
            'SELECT plan, plan_expires_at FROM users WHERE id = $1',
            [req.userId]
        );
        const { plan, plan_expires_at } = planRes.rows[0] || {};
        const isPlanActive = plan && plan !== 'free' &&
            plan_expires_at && new Date(plan_expires_at) > new Date();

        const activePlan = isPlanActive ? plan : 'free';

        const REPLY_WINDOW_TEXT = {
            free: 'Check your email within a few working days for our reply.',
            pro: 'Check your email within 2 days for our reply.',
            premium: 'Check your email within a few hours for our reply.',
        };

        const replyText = REPLY_WINDOW_TEXT[activePlan];

        await insertNotification(
            req.userId,
            'support_received',
            `We've received your message\n${replyText}`,
            result.rows[0].id,
            '/contact'
        );

        res.status(201).json({ message: 'Support request submitted' });
    } catch (err) {
        console.error('Create support request error:', err);
        res.status(500).json({ error: 'Something went wrong submitting your request' });
    }
});

// GET /api/support/mine — the current user's own support requests
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, message, status, created_at, replied_at
             FROM support_requests
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get my support requests error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your requests' });
    }
});

module.exports = router;