const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/stories/feed — anyone can view
router.get('/feed', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at,
             u.name AS user_name, u.avatar_url AS user_avatar, u.plan AS user_plan,
             EXISTS (
               SELECT 1 FROM story_views v
               WHERE v.story_id = s.id AND v.viewer_id = $1
             ) AS viewed
      FROM stories s
      JOIN users u ON u.id = s.user_id
      WHERE s.expires_at > NOW()
      ORDER BY s.created_at DESC
    `, [req.userId]);

    const groupsMap = new Map();
    for (const row of rows) {
      if (!groupsMap.has(row.user_id)) {
        groupsMap.set(row.user_id, {
          user_id: row.user_id,
          user_name: row.user_name,
          user_avatar: row.user_avatar,
          user_plan: row.user_plan,
          stories: [],
        });
      }
      groupsMap.get(row.user_id).stories.push({
        id: row.id,
        user_id: row.user_id,
        user_name: row.user_name,
        user_avatar: row.user_avatar,
        media_url: row.media_url,
        media_type: row.media_type,
        caption: row.caption,
        created_at: row.created_at,
        viewed: row.viewed,
      });
    }

    const groups = [...groupsMap.values()].map((g) => ({
      ...g,
      stories: g.stories.reverse(),
      allViewed: g.stories.every((s) => s.viewed),
    }));

    res.json(groups);
  } catch (err) {
    console.error('Stories feed error:', err);
    res.status(500).json({ error: 'Failed to load stories' });
  }
});

// GET /api/stories/:id — single story, regardless of expiry (used for chat deep-links)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at,
             u.name AS user_name, u.avatar_url AS user_avatar, u.plan AS user_plan
      FROM stories s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Story not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Get story error:', err);
    res.status(500).json({ error: 'Failed to load story' });
  }
});

// POST /api/stories — paid users only
router.post('/', requireAuth, async (req, res) => {
  const { media } = req.body; // [{ media_url, media_type, caption }]
  if (!Array.isArray(media) || media.length === 0) {
    return res.status(400).json({ error: 'No media provided' });
  }

  try {
    const userResult = await pool.query(
      'SELECT plan, plan_expires_at FROM users WHERE id = $1',
      [req.userId]
    );
    const user = userResult.rows[0];
    const planActive = user?.plan && user.plan !== 'free' &&
      user.plan_expires_at && new Date(user.plan_expires_at) > new Date();
    if (!planActive) {
      return res.status(403).json({ error: 'Pro or Premium plan required to post stories' });
    }

    const inserted = [];
    for (const item of media) {
      const { rows } = await pool.query(
        `INSERT INTO stories (user_id, media_url, media_type, caption)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.userId, item.media_url, item.media_type, item.caption || null]
      );
      inserted.push(rows[0]);
    }
    res.status(201).json(inserted);
  } catch (err) {
    console.error('Post story error:', err);
    res.status(500).json({ error: 'Failed to post story' });
  }
});

// POST /api/stories/:id/view
router.post('/:id/view', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO story_views (story_id, viewer_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.params.id, req.userId]
    );
    res.sendStatus(204);
  } catch (err) {
    console.error('View story error:', err);
    res.status(500).json({ error: 'Failed to mark viewed' });
  }
});

module.exports = router;