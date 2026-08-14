const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications
router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, type, message, related_id, read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// POST /api/notifications/read
router.post('/read', requireAuth, async (req, res) => {
    const { id } = req.body;
    try {
        if (id) {
            await pool.query(
                `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`,
                [id, req.userId]
            );
        } else {
            await pool.query(
                `UPDATE notifications SET read = TRUE WHERE user_id = $1`,
                [req.userId]
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Mark read error:', err);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
});

// DELETE /api/notifications
router.delete('/', requireAuth, async (req, res) => {
    try {
        await pool.query(`DELETE FROM notifications WHERE user_id = $1`, [req.userId]);
        res.json({ success: true });
    } catch (err) {
        console.error('Clear notifications error:', err);
        res.status(500).json({ error: 'Failed to clear notifications' });
    }
});

module.exports = router;