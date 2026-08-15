const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Checks whether this buyer has any orders that were marked delivered by a seller
// but not yet confirmed, and are due for another reminder (10+ minutes since the
// last one). Runs on every notifications fetch — no separate cron job needed,
// since the reminder is only ever inserted at most once per 10-minute window
// regardless of how often this gets called.
async function checkAndSendDeliveryReminders(userId) {
    try {
        const dueResult = await pool.query(
            `SELECT o.id, u.location AS buyer_location, s.name AS seller_name
             FROM orders o
             JOIN users u ON u.id = o.buyer_id
             JOIN users s ON s.id = o.delivered_by_seller_id
             WHERE o.buyer_id = $1
               AND o.status = 'paid'
               AND o.delivered_at IS NOT NULL
               AND (o.last_delivery_reminder_at IS NULL OR o.last_delivery_reminder_at <= now() - interval '10 minutes')`,
            [userId]
        );

        for (const row of dueResult.rows) {
            const message = `Reminder: ${row.seller_name} marked your order as delivered to ${row.buyer_location || 'your location'}. Please go to your Orders tab to confirm receipt.`;
            await pool.query(
                `INSERT INTO notifications (user_id, type, message, related_id) VALUES ($1, $2, $3, $4)`,
                [userId, 'delivery_reminder', message, row.id]
            );
            await pool.query(`UPDATE orders SET last_delivery_reminder_at = now() WHERE id = $1`, [row.id]);
        }
    } catch (err) {
        console.error('Delivery reminder check error:', err);
    }
}

// GET /api/notifications
router.get('/', requireAuth, async (req, res) => {
    try {
        await checkAndSendDeliveryReminders(req.userId);

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