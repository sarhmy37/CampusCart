const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications
router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                n.id, n.type, n.message, n.related_id, n.link, n.read, n.created_at,
                CASE
                  WHEN n.type = 'new_message' AND n.related_id IS NOT NULL
                  THEN (
                    SELECT CASE WHEN c.buyer_id = $1 THEN su.avatar_url ELSE bu.avatar_url END
                    FROM conversations c
                    JOIN users bu ON bu.id = c.buyer_id
                    JOIN users su ON su.id = c.seller_id
                    WHERE c.id = n.related_id
                  )
                  ELSE NULL
                END AS sender_avatar,
                CASE
                  WHEN n.type = 'new_message' AND n.related_id IS NOT NULL
                  THEN (
                    SELECT CASE WHEN c.buyer_id = $1 THEN su.name ELSE bu.name END
                    FROM conversations c
                    JOIN users bu ON bu.id = c.buyer_id
                    JOIN users su ON su.id = c.seller_id
                    WHERE c.id = n.related_id
                  )
                  ELSE NULL
                END AS sender_name
             FROM notifications n
             WHERE n.user_id = $1
             ORDER BY n.created_at DESC`,
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

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
            [id, req.userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Delete notification error:', err);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

module.exports = router;