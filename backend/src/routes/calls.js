const express = require('express');
const crypto = require('crypto');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { requireAuth } = require('../middleware/auth');
const pool = require('../db/pool');
const { sendPushNotification } = require('../utils/pushService');

const router = express.Router();

// POST /api/calls/token — returns an Agora token + channel for a 1-to-1 call
router.post('/token', requireAuth, (req, res) => {
    const { otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });

    // Same channel for both people, under Agora's 64-char limit
    const channel = crypto
        .createHash('sha1')
        .update([String(req.userId), String(otherUserId)].sort().join(':'))
        .digest('hex');

    const expireAt = Math.floor(Date.now() / 1000) + 60 * 60;
    const token = RtcTokenBuilder.buildTokenWithUid(
        process.env.AGORA_APP_ID,
        process.env.AGORA_APP_CERTIFICATE,
        channel,
        0,
        RtcRole.PUBLISHER,
        expireAt,
        expireAt
    );

    res.json({ appId: process.env.AGORA_APP_ID, channel, token });
});

// POST /api/calls/start — caller rings someone
router.post('/start', requireAuth, async (req, res) => {
    const { otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });
    try {
        const target = await pool.query('SELECT push_token, banned FROM users WHERE id = $1', [otherUserId]);
        if (!target.rows[0] || target.rows[0].banned) {
            return res.status(404).json({ error: 'User not available' });
        }
        await pool.query(
            `UPDATE calls SET status = 'missed' WHERE caller_id = $1 AND status IN ('ringing', 'delivered')`,
            [req.userId]
        );
        const created = await pool.query(
            'INSERT INTO calls (caller_id, callee_id) VALUES ($1, $2) RETURNING id',
            [req.userId, otherUserId]
        );
        const me = await pool.query('SELECT name FROM users WHERE id = $1', [req.userId]);
        if (target.rows[0].push_token) {
            Promise.resolve(
                sendPushNotification(target.rows[0].push_token, 'Incoming call', `${me.rows[0]?.name || 'Someone'} is calling you`, {
                    type: 'call', call_id: created.rows[0].id,
                })
            ).catch(() => {});
        }
        res.json({ id: created.rows[0].id });
    } catch (err) {
        console.error('Start call error:', err);
        res.status(500).json({ error: 'Could not start the call' });
    }
});

// GET /api/calls/incoming — the call currently ringing for me (if any)
router.get('/incoming', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.caller_id, u.name AS caller_name, u.avatar_url AS caller_avatar
             FROM calls c JOIN users u ON u.id = c.caller_id
             WHERE c.callee_id = $1 AND c.status = 'ringing'
               AND c.created_at > now() - interval '40 seconds'
             ORDER BY c.created_at DESC LIMIT 1`,
            [req.userId]
        );
        res.json(result.rows[0] || null);
    } catch (err) {
        console.error('Incoming call error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// GET /api/calls/:id — status of a call (caller polls this while ringing)
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, status FROM calls WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)`,
            [req.params.id, req.userId]
        );
        if (!result.rows[0]) return res.status(404).json({ error: 'Call not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get call error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// POST /api/calls/:id/ringing — callee's phone confirms it received the call
router.post('/:id/ringing', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE calls SET status = 'delivered'
             WHERE id = $1 AND callee_id = $2 AND status = 'ringing'
             RETURNING id, status`,
            [req.params.id, req.userId]
        );
        res.json(result.rows[0] || { id: req.params.id, status: 'unchanged' });
    } catch (err) {
        console.error('Ringing call error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// POST /api/calls/:id/answer | decline | end
const CALL_ACTIONS = { answer: 'answered', decline: 'declined', end: 'ended' };
router.post('/:id/:action', requireAuth, async (req, res) => {
    const status = CALL_ACTIONS[req.params.action];
    if (!status) return res.status(400).json({ error: 'Invalid action' });
    try {
        const result = await pool.query(
            `UPDATE calls SET status = $1
             WHERE id = $2 AND (caller_id = $3 OR callee_id = $3)
               AND ($1 <> 'answered' OR callee_id = $3)
               AND status NOT IN ('declined', 'ended', 'missed')
             RETURNING id, status`,
            [status, req.params.id, req.userId]
        );
        res.json(result.rows[0] || { id: req.params.id, status: 'closed' });
    } catch (err) {
        console.error('Call action error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

module.exports = router;