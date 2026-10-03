const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/stories/feed — anyone can view
router.get('/feed', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at, s.content_type,
             s.trim_start_ms, s.trim_end_ms,
             (SELECT COUNT(*) FROM story_views vc WHERE vc.story_id = s.id) AS view_count,
             u.name AS user_name, u.avatar_url AS user_avatar,
             (u.account_type = 'seller') AS is_seller,
             CASE WHEN u.plan IN ('pro', 'premium') AND u.plan_expires_at > NOW() THEN u.plan ELSE NULL END AS user_plan,
             CASE WHEN u.account_type = 'seller'
               THEN (SELECT COUNT(*) FROM order_items oi WHERE oi.seller_id = u.id AND oi.buyer_confirmed_at IS NOT NULL)
               ELSE (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id)
             END AS activity_count,
             EXISTS (
               SELECT 1 FROM story_views v
               WHERE v.story_id = s.id AND v.viewer_id = $1
             ) AS viewed,
             (SELECT COUNT(*) FROM story_likes l WHERE l.story_id = s.id) AS like_count,
             EXISTS (
               SELECT 1 FROM story_likes l
               WHERE l.story_id = s.id AND l.user_id = $1
             ) AS liked,
             (SELECT COUNT(*) FROM story_comments c WHERE c.story_id = s.id) AS comment_count
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
          is_seller: row.is_seller,
          activity_count: Number(row.activity_count),
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
        content_type: row.content_type,
        trim_start_ms: row.trim_start_ms,
        trim_end_ms: row.trim_end_ms,
        view_count: Number(row.view_count),
        like_count: Number(row.like_count),
        liked: row.liked,
        comment_count: Number(row.comment_count),
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

// GET /api/stories/mine — the current user's own active stories, with view counts
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.media_url, s.media_type, s.caption, s.created_at,
             (SELECT COUNT(*) FROM story_views v WHERE v.story_id = s.id) AS view_count
      FROM stories s
      WHERE s.user_id = $1 AND s.expires_at > NOW()
      ORDER BY s.created_at ASC
    `, [req.userId]);
    res.json(rows);
  } catch (err) {
    console.error('My stories error:', err);
    res.status(500).json({ error: 'Failed to load your stories' });
  }
});

// GET /api/stories/:id — single story, regardless of expiry (used for chat deep-links)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at,
             s.trim_start_ms, s.trim_end_ms,
             u.name AS user_name, u.avatar_url AS user_avatar, u.plan AS user_plan,
             (SELECT COUNT(*) FROM story_likes l WHERE l.story_id = s.id) AS like_count,
             EXISTS (
               SELECT 1 FROM story_likes l
               WHERE l.story_id = s.id AND l.user_id = $2
             ) AS liked,
             (SELECT COUNT(*) FROM story_comments c WHERE c.story_id = s.id) AS comment_count
      FROM stories s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
    `, [req.params.id, req.userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Story not found' });
    const r = rows[0];
    res.json({
      ...r,
      like_count: Number(r.like_count),
      comment_count: Number(r.comment_count),
    });
  } catch (err) {
    console.error('Get story error:', err);
    res.status(500).json({ error: 'Failed to load story' });
  }
});

// POST /api/stories — paid users only
router.post('/', requireAuth, async (req, res) => {
  const { media } = req.body;
  const ALLOWED_TAGS = ['products', 'services', 'deals', 'announcements', 'campus', 'tips', 'events'];
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
      const isVideo = item.media_type === 'video';
      const trimStart = isVideo && Number.isFinite(item.trim_start_ms) ? Math.max(0, Math.round(item.trim_start_ms)) : null;
      let trimEnd = isVideo && Number.isFinite(item.trim_end_ms) ? Math.round(item.trim_end_ms) : null;
      if (trimStart !== null && trimEnd !== null) {
        // keep it valid: end after start, never longer than 60s
        trimEnd = Math.min(Math.max(trimEnd, trimStart + 1000), trimStart + 60000);
      }

      const { rows } = await pool.query(
        `INSERT INTO stories (user_id, media_url, media_type, caption, content_type, trim_start_ms, trim_end_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          req.userId, item.media_url, item.media_type, item.caption || null,
          ALLOWED_TAGS.includes(item.content_type) ? item.content_type : null,
          trimStart, trimEnd,
        ]
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

// POST /api/stories/:id/like
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO story_likes (story_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.params.id, req.userId]
    );
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS like_count FROM story_likes WHERE story_id = $1',
      [req.params.id]
    );
    res.json({ liked: true, like_count: rows[0].like_count });
  } catch (err) {
    console.error('Like story error:', err);
    res.status(500).json({ error: 'Failed to like story' });
  }
});

// DELETE /api/stories/:id/like
router.delete('/:id/like', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM story_likes WHERE story_id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS like_count FROM story_likes WHERE story_id = $1',
      [req.params.id]
    );
    res.json({ liked: false, like_count: rows[0].like_count });
  } catch (err) {
    console.error('Unlike story error:', err);
    res.status(500).json({ error: 'Failed to unlike story' });
  }
});

// GET /api/stories/:id/comments
router.get('/:id/comments', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.text, c.created_at, c.user_id, c.parent_id,
              u.name AS user_name, u.avatar_url AS user_avatar,
              (SELECT COUNT(*)::int FROM story_comments r WHERE r.parent_id = c.id) AS reply_count
       FROM story_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.story_id = $1 AND c.parent_id IS NULL
       ORDER BY c.created_at DESC
       LIMIT 100`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Failed to load comments' });
  }
});

// GET /api/stories/:id/comments/:commentId/replies
router.get('/:id/comments/:commentId/replies', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.text, c.created_at, c.user_id, c.parent_id,
              u.name AS user_name, u.avatar_url AS user_avatar
       FROM story_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.story_id = $1 AND c.parent_id = $2
       ORDER BY c.created_at ASC
       LIMIT 100`,
      [req.params.id, req.params.commentId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get replies error:', err);
    res.status(500).json({ error: 'Failed to load replies' });
  }
});

// POST /api/stories/:id/comments
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const text = String(req.body.text || '').trim().slice(0, 300);
    if (!text) return res.status(400).json({ error: 'Comment is empty' });

    // replying to a comment? Replies stay one level deep: a reply to a reply
    // is attached to the original comment.
    let parentId = req.body.parent_id || null;
    if (parentId) {
      const parent = await pool.query(
        'SELECT id, parent_id FROM story_comments WHERE id = $1 AND story_id = $2',
        [parentId, req.params.id]
      );
      if (parent.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
      parentId = parent.rows[0].parent_id || parent.rows[0].id;
    }

    const { rows } = await pool.query(
      `WITH ins AS (
         INSERT INTO story_comments (story_id, user_id, text, parent_id)
         VALUES ($1, $2, $3, $4) RETURNING *
       )
       SELECT ins.id, ins.text, ins.created_at, ins.user_id, ins.parent_id,
              u.name AS user_name, u.avatar_url AS user_avatar
       FROM ins JOIN users u ON u.id = ins.user_id`,
      [req.params.id, req.userId, text, parentId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Post comment error:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// DELETE /api/stories/:id — owner only
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM stories WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Story not found' });
    res.sendStatus(204);
  } catch (err) {
    console.error('Delete story error:', err);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;