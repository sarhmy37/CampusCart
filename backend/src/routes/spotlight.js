const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// PATCH /api/spotlight/profile — cover_url and/or spotlight_bio
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const { cover_url, spotlight_bio } = req.body;
    const { rows } = await pool.query(
      `UPDATE users SET
         cover_url = COALESCE($2, cover_url),
         spotlight_bio = COALESCE($3, spotlight_bio)
       WHERE id = $1
       RETURNING cover_url, spotlight_bio`,
      [
        req.userId,
        typeof cover_url === 'string' ? cover_url : null,
        typeof spotlight_bio === 'string' ? spotlight_bio.trim().slice(0, 140) : null,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Spotlight profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;