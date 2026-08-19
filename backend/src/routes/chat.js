const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/chat/start — find or create a conversation with a seller
router.post('/start', requireAuth, async (req, res) => {
    const { sellerId, productId } = req.body;
    if (!sellerId) return res.status(400).json({ error: 'sellerId is required' });

    try {
        const existing = await pool.query(
            `SELECT id FROM conversations
             WHERE buyer_id = $1 AND seller_id = $2
               AND product_id IS NOT DISTINCT FROM $3`,
            [req.userId, sellerId, productId || null]
        );

        let conversationId;
        if (existing.rows.length > 0) {
            conversationId = existing.rows[0].id;
        } else {
            const inserted = await pool.query(
                `INSERT INTO conversations (buyer_id, seller_id, product_id) VALUES ($1, $2, $3) RETURNING id`,
                [req.userId, sellerId, productId || null]
            );
            conversationId = inserted.rows[0].id;
        }

        const seller = await pool.query(`SELECT name FROM users WHERE id = $1`, [sellerId]);

        res.json({ id: conversationId, seller_name: seller.rows[0]?.name || 'Seller' });
    } catch (err) {
        console.error('Start conversation error:', err);
        res.status(500).json({ error: 'Failed to start conversation' });
    }
});

// GET /api/chat/:id/messages
router.get('/:id/messages', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const convo = await pool.query(
            `SELECT buyer_id, seller_id FROM conversations WHERE id = $1`,
            [id]
        );
        if (convo.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });
        const { buyer_id, seller_id } = convo.rows[0];
        if (req.userId !== buyer_id && req.userId !== seller_id) {
            return res.status(403).json({ error: 'Not part of this conversation' });
        }

        await pool.query(
            `UPDATE messages SET read = TRUE WHERE conversation_id = $1 AND sender_id != $2`,
            [id, req.userId]
        );

        const messages = await pool.query(
            `SELECT id, sender_id, content, read, created_at
             FROM messages WHERE conversation_id = $1
             ORDER BY created_at ASC`,
            [id]
        );
        res.json(messages.rows);
    } catch (err) {
        console.error('Get messages error:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// POST /api/chat/:id/messages
router.post('/:id/messages', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Message content required' });

    try {
        const convo = await pool.query(
            `SELECT buyer_id, seller_id FROM conversations WHERE id = $1`,
            [id]
        );
        if (convo.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });
        const { buyer_id, seller_id } = convo.rows[0];
        if (req.userId !== buyer_id && req.userId !== seller_id) {
            return res.status(403).json({ error: 'Not part of this conversation' });
        }

        const inserted = await pool.query(
            `INSERT INTO messages (conversation_id, sender_id, content) VALUES ($1, $2, $3)
             RETURNING id, sender_id, content, read, created_at`,
            [id, req.userId, content.trim()]
        );
        res.json(inserted.rows[0]);
    } catch (err) {
        console.error('Send message error:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// GET /api/chat/conversations — inbox list for the logged-in user (as buyer or seller)
router.get('/conversations', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                c.id,
                CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END AS other_user_id,
                CASE WHEN c.buyer_id = $1 THEN su.name ELSE bu.name END AS other_user_name,
                p.title AS product_title,
                lm.content AS last_message,
                lm.created_at AS last_message_at,
                COALESCE(uc.unread_count, 0) AS unread_count
             FROM conversations c
             JOIN users bu ON bu.id = c.buyer_id
             JOIN users su ON su.id = c.seller_id
             LEFT JOIN products p ON p.id = c.product_id
             LEFT JOIN LATERAL (
                 SELECT content, created_at FROM messages m
                 WHERE m.conversation_id = c.id
                 ORDER BY m.created_at DESC
                 LIMIT 1
             ) lm ON true
             LEFT JOIN LATERAL (
                 SELECT COUNT(*) AS unread_count FROM messages m
                 WHERE m.conversation_id = c.id AND m.sender_id != $1 AND m.read = FALSE
             ) uc ON true
             WHERE c.buyer_id = $1 OR c.seller_id = $1
             ORDER BY lm.created_at DESC NULLS LAST`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get conversations error:', err);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

module.exports = router;