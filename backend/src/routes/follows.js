const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/follows/check — which of these users do I already follow?
router.post('/check', requireAuth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 50).map(String) : [];
    if (ids.length === 0) return res.json({ following: [] });
    const { rows } = await pool.query(
      'SELECT following_id FROM follows WHERE follower_id = $1 AND following_id = ANY($2::uuid[])',
      [req.userId, ids]
    );
    res.json({ following: rows.map((r) => String(r.following_id)) });
  } catch (err) {
    console.error('Follow check error:', err);
    res.status(500).json({ error: 'Failed to check follows' });
  }
});

// POST /api/follows/:userId — follow someone
router.post('/:userId', requireAuth, async (req, res) => {
  try {
    if (String(req.params.userId) === String(req.userId)) {
      return res.status(400).json({ error: "You can't follow yourself" });
    }
    const exists = await pool.query('SELECT 1 FROM users WHERE id = $1', [req.params.userId]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await pool.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.userId, req.params.userId]
    );
    res.json({ following: true });
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ error: 'Failed to follow' });
  }
});

// DELETE /api/follows/:userId — unfollow
router.delete('/:userId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.userId, req.params.userId]
    );
    res.json({ following: false });
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(500).json({ error: 'Failed to unfollow' });
  }
});

// GET /api/follows/stats/:userId — counts + whether I follow them
router.get('/stats/:userId', requireAuth, async (req, res) => {
  try {
    const { rows: [r] } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM follows WHERE following_id = $1) AS followers,
         (SELECT COUNT(*)::int FROM follows WHERE follower_id = $1) AS following,
         EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1) AS i_follow`,
      [req.params.userId, req.userId]
    );
    res.json(r);
  } catch (err) {
    console.error('Follow stats error:', err);
    res.status(500).json({ error: 'Failed to load follow info' });
  }
});

module.exports = router;