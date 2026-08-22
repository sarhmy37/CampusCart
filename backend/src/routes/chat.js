const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { uploadChatMedia, uploadWallpaper } = require('../middleware/upload');

const router = express.Router();

async function touchLastActive(userId) {
    try {
        await pool.query(`UPDATE users SET last_active_at = now() WHERE id = $1`, [userId]);
    } catch (err) {
        console.error('Touch last_active_at error:', err);
    }
}

// Shared helper: confirms the requesting user is actually part of this
// conversation before letting them read/write anything tied to it.
async function getConversationOrForbid(conversationId, userId, res) {
    const convo = await pool.query(
        `SELECT buyer_id, seller_id FROM conversations WHERE id = $1`,
        [conversationId]
    );
    if (convo.rows.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return null;
    }
    const { buyer_id, seller_id } = convo.rows[0];
    if (userId !== buyer_id && userId !== seller_id) {
        res.status(403).json({ error: 'Not part of this conversation' });
        return null;
    }
    return convo.rows[0];
}

// POST /api/chat/start — find or create a conversation with a seller
router.post('/start', requireAuth, async (req, res) => {
    const { sellerId, productId } = req.body;
    if (!sellerId) return res.status(400).json({ error: 'sellerId is required' });

    try {
        // 👇 Check if the seller is banned
        const sellerCheck = await pool.query(
            'SELECT id, banned, name FROM users WHERE id = $1',
            [sellerId]
        );
        if (sellerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Seller not found' });
        }
        if (sellerCheck.rows[0].banned) {
            return res.status(403).json({ 
                error: 'This seller\'s account has been banned.',
                banned: true 
            });
        }

        await touchLastActive(req.userId);

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

        const seller = await pool.query(`SELECT name, avatar_url FROM users WHERE id = $1`, [sellerId]);

        res.json({
            id: conversationId,
            seller_name: seller.rows[0]?.name || 'Seller',
            seller_avatar: seller.rows[0]?.avatar_url || null,
        });
    } catch (err) {
        console.error('Start conversation error:', err);
        res.status(500).json({ error: 'Failed to start conversation' });
    }
});

// GET /api/chat/conversations — inbox list for the logged-in user (as buyer or seller)
router.get('/conversations', requireAuth, async (req, res) => {
    try {
        await touchLastActive(req.userId);

        const result = await pool.query(
            `SELECT
                c.id,
                CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END AS other_user_id,
                CASE WHEN c.buyer_id = $1 THEN su.name ELSE bu.name END AS other_user_name,
                CASE WHEN c.buyer_id = $1 THEN su.avatar_url ELSE bu.avatar_url END AS other_user_avatar,
                CASE WHEN c.buyer_id = $1 THEN su.last_active_at ELSE bu.last_active_at END AS other_user_last_active,
                p.title AS product_title,
                COALESCE(lm.content, CASE WHEN lm.media_type = 'audio' THEN '🎤 Voice note' WHEN lm.media_type = 'image' THEN '📷 Photo' ELSE NULL END) AS last_message,
                lm.created_at AS last_message_at,
                COALESCE(uc.unread_count, 0) AS unread_count
             FROM conversations c
             JOIN users bu ON bu.id = c.buyer_id
             JOIN users su ON su.id = c.seller_id
             LEFT JOIN products p ON p.id = c.product_id
             LEFT JOIN LATERAL (
                 SELECT content, media_type, created_at FROM messages m
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

// GET /api/chat/presence/:userId — last-active timestamp for one user
router.get('/presence/:userId', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`SELECT last_active_at FROM users WHERE id = $1`, [req.params.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ last_active_at: result.rows[0].last_active_at });
    } catch (err) {
        console.error('Get presence error:', err);
        res.status(500).json({ error: 'Failed to fetch presence' });
    }
});

// GET /api/chat/:id/wallpaper — this user's wallpaper choice for this conversation
router.get('/:id/wallpaper', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const convo = await getConversationOrForbid(id, req.userId, res);
        if (!convo) return;

        const result = await pool.query(
            `SELECT wallpaper_type AS type, wallpaper_value AS value
             FROM chat_wallpapers
             WHERE conversation_id = $1 AND user_id = $2`,
            [id, req.userId]
        );

        if (result.rows.length === 0) {
            return res.json({ type: 'none', value: null });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get wallpaper error:', err);
        res.status(500).json({ error: 'Failed to load wallpaper' });
    }
});

// PUT /api/chat/:id/wallpaper — set a preset wallpaper, or clear it back to 'none'
router.put('/:id/wallpaper', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { type, value } = req.body;

    if (!['none', 'preset', 'custom'].includes(type)) {
        return res.status(400).json({ error: 'Invalid wallpaper type' });
    }

    try {
        const convo = await getConversationOrForbid(id, req.userId, res);
        if (!convo) return;

        const result = await pool.query(
            `INSERT INTO chat_wallpapers (conversation_id, user_id, wallpaper_type, wallpaper_value, updated_at)
             VALUES ($1, $2, $3, $4, now())
             ON CONFLICT (conversation_id, user_id)
             DO UPDATE SET wallpaper_type = $3, wallpaper_value = $4, updated_at = now()
             RETURNING wallpaper_type AS type, wallpaper_value AS value`,
            [id, req.userId, type, value || null]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Set wallpaper error:', err);
        res.status(500).json({ error: 'Failed to update wallpaper' });
    }
});

// POST /api/chat/:id/wallpaper/upload — custom image wallpaper
// Uses uploadWallpaper (image-only, unlike uploadChatMedia which also allows
// audio for voice notes). Stored as a base64 data URL, same pattern as /media.
router.post('/:id/wallpaper/upload', requireAuth, uploadWallpaper.single('wallpaper'), async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
        return res.status(400).json({ error: 'No file received' });
    }

    try {
        const convo = await getConversationOrForbid(id, req.userId, res);
        if (!convo) return;

        const imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        const result = await pool.query(
            `INSERT INTO chat_wallpapers (conversation_id, user_id, wallpaper_type, wallpaper_value, updated_at)
             VALUES ($1, $2, 'custom', $3, now())
             ON CONFLICT (conversation_id, user_id)
             DO UPDATE SET wallpaper_type = 'custom', wallpaper_value = $3, updated_at = now()
             RETURNING wallpaper_type AS type, wallpaper_value AS value`,
            [id, req.userId, imageUrl]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Upload wallpaper error:', err);
        res.status(500).json({ error: 'Something went wrong uploading your wallpaper' });
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

        await touchLastActive(req.userId);

        await pool.query(
            `UPDATE messages SET read = TRUE WHERE conversation_id = $1 AND sender_id != $2`,
            [id, req.userId]
        );

        const messages = await pool.query(
            `SELECT id, sender_id, content, media_url, media_type, read, created_at
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

// POST /api/chat/:id/media — send an image or voice note as a message
router.post('/:id/media', requireAuth, uploadChatMedia.single('media'), async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
        return res.status(400).json({ error: 'No file received' });
    }

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

        await touchLastActive(req.userId);

        const mediaUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        const mediaType = req.file.mimetype.startsWith('audio/') ? 'audio' : 'image';

        const inserted = await pool.query(
            `INSERT INTO messages (conversation_id, sender_id, media_url, media_type)
             VALUES ($1, $2, $3, $4)
             RETURNING id, sender_id, content, media_url, media_type, read, created_at`,
            [id, req.userId, mediaUrl, mediaType]
        );
        res.json(inserted.rows[0]);
    } catch (err) {
        console.error('Send media error:', err);
        res.status(500).json({ error: 'Something went wrong sending your media' });
    }
});

// POST /api/chat/:id/messages
router.post('/:id/messages', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { content, media_url, media_type } = req.body;

    if ((!content || !content.trim()) && !media_url) {
        return res.status(400).json({ error: 'Message must include text or media' });
    }

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

        await touchLastActive(req.userId);

        const inserted = await pool.query(
            `INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, sender_id, content, media_url, media_type, read, created_at`,
            [id, req.userId, content?.trim() || null, media_url || null, media_type || null]
        );
        res.json(inserted.rows[0]);
    } catch (err) {
        console.error('Send message error:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;