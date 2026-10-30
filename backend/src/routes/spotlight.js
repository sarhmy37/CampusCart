const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// PATCH /api/spotlight/profile — cover_url and/or spotlight_bio
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const { cover_url, spotlight_bio } = req.body;
    const flag = (k) => (typeof req.body[k] === 'boolean' ? req.body[k] : null);
    const { rows } = await pool.query(
      `UPDATE users SET
         cover_url = COALESCE($2, cover_url),
         spotlight_bio = COALESCE($3, spotlight_bio),
         spotlight_allow_chat = COALESCE($4, spotlight_allow_chat),
         spotlight_show_likes = COALESCE($5, spotlight_show_likes),
         spotlight_allow_repost = COALESCE($6, spotlight_allow_repost),
         spotlight_allow_export = COALESCE($7, spotlight_allow_export)
       WHERE id = $1
       RETURNING cover_url, spotlight_bio, spotlight_allow_chat, spotlight_show_likes, spotlight_allow_repost, spotlight_allow_export`,
      [
        req.userId,
        typeof cover_url === 'string' ? cover_url : null,
        typeof spotlight_bio === 'string' ? spotlight_bio.trim().slice(0, 140) : null,
        flag('spotlight_allow_chat'),
        flag('spotlight_show_likes'),
        flag('spotlight_allow_repost'),
        flag('spotlight_allow_export'),
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Spotlight profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;