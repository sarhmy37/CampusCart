const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { ensureWatermarked } = require('./storyExport');
const { insertNotification } = require('../utils/notifications');

const router = express.Router();

async function notifyStoryLike(storyId, likerId) {
  try {
    const { rows: [s] } = await pool.query(
      `SELECT s.user_id, s.kind, u.name AS actor
       FROM stories s, users u WHERE s.id = $1 AND u.id = $2`,
      [storyId, likerId]
    );
    if (!s || String(s.user_id) === String(likerId)) return;
    const what = s.kind === 'spotlight' ? 'reel' : 'status';
    const message = `${s.actor} liked your ${what}`;
    const dup = await pool.query(
      `SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'story_like' AND related_id = $2 AND message = $3`,
      [s.user_id, storyId, message]
    );
    if (dup.rows.length) return;
    await insertNotification(s.user_id, 'story_like', message, storyId, `/stories?openStoryId=${storyId}`);
  } catch (err) { console.error('Story like notify error:', err); }
}

async function notifyStoryRepost(storyId, reposterId) {
  try {
    const { rows: [s] } = await pool.query(
      `SELECT s.user_id, s.kind, u.name AS actor
       FROM stories s, users u WHERE s.id = $1 AND u.id = $2`,
      [storyId, reposterId]
    );
    if (!s || String(s.user_id) === String(reposterId)) return;
    const what = s.kind === 'spotlight' ? 'reel' : 'status';
    const message = `${s.actor} reposted your ${what}`;
    const dup = await pool.query(
      `SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'story_repost' AND related_id = $2 AND message = $3`,
      [s.user_id, storyId, message]
    );
    if (dup.rows.length) return;
    await insertNotification(s.user_id, 'story_repost', message, storyId, `/stories?openStoryId=${storyId}`);
  } catch (err) { console.error('Story repost notify error:', err); }
}

async function notifyStoryComment(storyId, commenterId, text, isReply) {
  try {
    const { rows: [s] } = await pool.query(
      `SELECT s.user_id, s.kind, u.name AS actor
       FROM stories s, users u WHERE s.id = $1 AND u.id = $2`,
      [storyId, commenterId]
    );
    if (!s || String(s.user_id) === String(commenterId)) return;
    const what = s.kind === 'spotlight' ? 'reel' : 'status';
    const snippet = text.length > 60 ? text.slice(0, 60) + '…' : text;
    await insertNotification(
      s.user_id, 'story_comment',
      `${s.actor} ${isReply ? 'replied on' : 'commented on'} your ${what}: "${snippet}"`,
      storyId, `/stories?openStoryId=${storyId}`
    );
  } catch (err) { console.error('Story comment notify error:', err); }
}

async function notifyCommentLike(storyId, commentId, likerId) {
  try {
    const { rows: [c] } = await pool.query(
      `SELECT c.user_id, c.text, u.name AS actor
       FROM story_comments c, users u WHERE c.id = $1 AND u.id = $2`,
      [commentId, likerId]
    );
    if (!c || String(c.user_id) === String(likerId)) return;
    const snippet = c.text.length > 40 ? c.text.slice(0, 40) + '…' : c.text;
    const message = `${c.actor} liked your comment: "${snippet}"`;
    const dup = await pool.query(
      `SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'comment_like' AND related_id = $2 AND message = $3`,
      [c.user_id, storyId, message]
    );
    if (dup.rows.length) return;
    await insertNotification(c.user_id, 'comment_like', message, storyId, `/stories?openStoryId=${storyId}`);
  } catch (err) { console.error('Comment like notify error:', err); }
}

async function notifyFollowersOfPost(authorId, firstStoryId, kind) {
  try {
    const { rows: [a] } = await pool.query('SELECT name FROM users WHERE id = $1', [authorId]);
    if (!a) return;
    const { rows: followers } = await pool.query(
      `SELECT f.follower_id FROM follows f
       WHERE f.following_id = $1
         AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = f.follower_id AND b.blocked_id = $1)`,
      [authorId]
    );
    const what = kind === 'spotlight' ? 'a new reel' : 'a new status';
    const message = `${a.name} posted ${what}`;
    for (const f of followers) {
      await insertNotification(f.follower_id, 'follow_post', message, firstStoryId, `/stories?openStoryId=${firstStoryId}`);
    }
  } catch (err) { console.error('Follower notify error:', err); }
}

// Top reposter: Premium > Pro > none, then most completed orders
const topReposter = (storyIdExpr) => `(
  SELECT json_build_object('name', ru.name, 'avatar', ru.avatar_url) FROM story_reposts r
  JOIN users ru ON ru.id = r.user_id
  WHERE r.story_id = ${storyIdExpr}
  ORDER BY
    CASE WHEN ru.plan = 'premium' AND ru.plan_expires_at > NOW() THEN 0
         WHEN ru.plan = 'pro' AND ru.plan_expires_at > NOW() THEN 1 ELSE 2 END,
    CASE WHEN ru.account_type = 'seller'
      THEN (SELECT COUNT(*) FROM order_items oi WHERE oi.seller_id = ru.id AND oi.buyer_confirmed_at IS NOT NULL)
      ELSE (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = ru.id)
    END DESC,
    r.created_at DESC
  LIMIT 1)`;

async function repostSummary(storyId) {
  const { rows: [r] } = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM story_reposts WHERE story_id = $1) AS repost_count,
            (SELECT MAX(created_at) FROM story_reposts WHERE story_id = $1) AS last_repost_at,
            ${topReposter('$1')} AS reposted_by_name`,
    [storyId]
  );
  return {
    repost_count: r.repost_count,
    reposted_by: r.reposted_by_name || null,
    last_repost_at: r.last_repost_at,
  };
}

// GET /api/stories/feed — anyone can view
router.get('/feed', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 0, 50) || null;
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const { rows } = await pool.query(`
      WITH page_users AS (
        SELECT st.user_id,
               GREATEST(MAX(st.created_at), COALESCE(MAX(rp.created_at), MAX(st.created_at))) AS latest,
               CASE WHEN $6::boolean THEN
                 (CASE WHEN EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = st.user_id) THEN 3 ELSE 0 END)
                 + LEAST(5, (SELECT COUNT(*) FROM story_likes l JOIN stories ls ON ls.id = l.story_id WHERE l.user_id = $1 AND ls.user_id = st.user_id))
                 + 0.5 * LEAST(10, (SELECT COUNT(*) FROM story_likes l JOIN stories ls ON ls.id = l.story_id
                     WHERE l.user_id = $1 AND ls.content_type IN (SELECT x.content_type FROM stories x WHERE x.user_id = st.user_id AND x.content_type IS NOT NULL AND x.expires_at > NOW())))
                 + LN(1 + (SELECT COUNT(*) FROM story_likes pl JOIN stories ps ON ps.id = pl.story_id WHERE ps.user_id = st.user_id AND ps.expires_at > NOW()))
                 + 4.0 / (1 + EXTRACT(EPOCH FROM (NOW() - MAX(st.created_at))) / 21600)
               ELSE EXTRACT(EPOCH FROM GREATEST(MAX(st.created_at), COALESCE(MAX(rp.created_at), MAX(st.created_at)))) END AS rank_key
        FROM stories st
        LEFT JOIN story_reposts rp ON rp.story_id = st.id
        WHERE st.expires_at > NOW() AND ($2::text IS NULL OR st.kind = $2)
          AND ($5::boolean IS NOT TRUE OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = st.user_id))
          AND NOT EXISTS (SELECT 1 FROM story_hidden h WHERE h.story_id = st.id AND h.user_id = $1)
          AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = st.user_id) OR (b.blocker_id = st.user_id AND b.blocked_id = $1))
        GROUP BY st.user_id
        ORDER BY rank_key DESC
        LIMIT $3::int OFFSET $4::int
      )
      SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at, s.content_type,
             s.trim_start_ms, s.trim_end_ms, s.kind, s.crop, s.product_tag, s.text_overlay, s.comments_off,
             COALESCE(s.export_count, 0) AS export_count,
             (SELECT COUNT(*) FROM story_views vc WHERE vc.story_id = s.id) AS view_count,
             EXISTS (SELECT 1 FROM follows fl WHERE fl.follower_id = $1 AND fl.following_id = s.user_id) AS is_following,
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
             (SELECT COUNT(*) FROM story_comments c WHERE c.story_id = s.id) AS comment_count,
             (SELECT COUNT(*) FROM story_reposts rp WHERE rp.story_id = s.id) AS repost_count,
             EXISTS (
               SELECT 1 FROM story_reposts rp
               WHERE rp.story_id = s.id AND rp.user_id = $1
             ) AS reposted,
             (SELECT MAX(rp.created_at) FROM story_reposts rp WHERE rp.story_id = s.id) AS last_repost_at,
             ${topReposter('s.id')} AS reposted_by_name
      FROM stories s
      JOIN page_users pu ON pu.user_id = s.user_id
      JOIN users u ON u.id = s.user_id
      WHERE s.expires_at > NOW() AND ($2::text IS NULL OR s.kind = $2)
        AND NOT EXISTS (SELECT 1 FROM story_hidden h WHERE h.story_id = s.id AND h.user_id = $1)
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = s.user_id) OR (b.blocker_id = s.user_id AND b.blocked_id = $1))
      ORDER BY pu.rank_key DESC, s.created_at DESC
    `, [req.userId, req.query.kind || null, limit, offset, req.query.following === 'true', req.query.foryou === 'true']);

    const groupsMap = new Map();
    for (const row of rows) {
      if (!groupsMap.has(row.user_id)) {
        groupsMap.set(row.user_id, {
          user_id: row.user_id,
          user_name: row.user_name,
          user_avatar: row.user_avatar,
          user_plan: row.user_plan,
          is_seller: row.is_seller,
          is_following: row.is_following,
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
        kind: row.kind,
        crop: row.crop,
        product_tag: row.product_tag,
        text_overlay: row.text_overlay,
        comments_off: row.comments_off,
        trim_start_ms: row.trim_start_ms,
        trim_end_ms: row.trim_end_ms,
        view_count: Number(row.view_count),
        like_count: Number(row.like_count),
        liked: row.liked,
        comment_count: Number(row.comment_count),
        export_count: Number(row.export_count),
        reposted: row.reposted,
        repost_count: Number(row.repost_count),
        last_repost_at: row.last_repost_at,
        reposted_by: row.reposted_by_name || null,
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
      SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at, s.kind, s.content_type,
             s.trim_start_ms, s.trim_end_ms, s.crop, s.product_tag, s.text_overlay,
             COALESCE(s.export_count, 0)::int AS export_count,
             (SELECT COUNT(*)::int FROM story_views v WHERE v.story_id = s.id) AS view_count,
             (SELECT COUNT(*)::int FROM story_likes l WHERE l.story_id = s.id) AS like_count,
             EXISTS (SELECT 1 FROM story_likes l WHERE l.story_id = s.id AND l.user_id = $1) AS liked,
             (SELECT COUNT(*)::int FROM story_comments c WHERE c.story_id = s.id) AS comment_count,
             (SELECT COUNT(*)::int FROM story_reposts rp WHERE rp.story_id = s.id) AS repost_count,
             EXISTS (SELECT 1 FROM story_reposts rp WHERE rp.story_id = s.id AND rp.user_id = $1) AS reposted,
             (SELECT MAX(rp.created_at) FROM story_reposts rp WHERE rp.story_id = s.id) AS last_repost_at,
             ${topReposter('s.id')} AS reposted_by
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

// GET /api/stories/reposts/mine — spotlights the current user has reposted
router.get('/reposts/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at, s.kind,
             s.trim_start_ms, s.trim_end_ms, s.crop, s.product_tag, s.text_overlay,
             COALESCE(s.export_count, 0)::int AS export_count,
             rp.created_at AS reposted_at,
             u.name AS owner_name, u.avatar_url AS owner_avatar,
             CASE WHEN u.plan IN ('pro', 'premium') AND u.plan_expires_at > NOW() THEN u.plan ELSE NULL END AS owner_plan,
             (SELECT COUNT(*)::int FROM story_views v WHERE v.story_id = s.id) AS view_count,
             (SELECT COUNT(*)::int FROM story_likes l WHERE l.story_id = s.id) AS like_count,
             EXISTS (SELECT 1 FROM story_likes l WHERE l.story_id = s.id AND l.user_id = $1) AS liked,
             (SELECT COUNT(*)::int FROM story_comments c WHERE c.story_id = s.id) AS comment_count,
             (SELECT COUNT(*)::int FROM story_reposts x WHERE x.story_id = s.id) AS repost_count,
             ${topReposter('s.id')} AS reposted_by
      FROM story_reposts rp
      JOIN stories s ON s.id = rp.story_id
      JOIN users u ON u.id = s.user_id
      WHERE rp.user_id = $1 AND s.kind = 'spotlight' AND s.expires_at > NOW()
      ORDER BY rp.created_at DESC
      LIMIT 100
    `, [req.userId]);
    res.json(rows);
  } catch (err) {
    console.error('My reposts error:', err);
    res.status(500).json({ error: 'Failed to load reposts' });
  }
});

// GET /api/stories/:id — single story, regardless of expiry (used for chat deep-links)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at,
             s.trim_start_ms, s.trim_end_ms, s.product_tag, s.crop, s.text_overlay, s.comments_off,
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

// POST /api/stories — any logged-in user
router.post('/', requireAuth, async (req, res) => {
  const { media } = req.body;
  const kind = req.body.kind === 'spotlight' ? 'spotlight' : 'story';
  const ALLOWED_TAGS = ['entertainment', 'educational', 'news', 'commercial', 'lifestyle', 'creative', 'inspirational'];
  if (!Array.isArray(media) || media.length === 0) {
    return res.status(400).json({ error: 'No media provided' });
  }

  try {
    const inserted = [];
    for (const item of media) {
      const isVideo = item.media_type === 'video';
      const trimStart = isVideo && Number.isFinite(item.trim_start_ms) ? Math.max(0, Math.round(item.trim_start_ms)) : null;
      let trimEnd = isVideo && Number.isFinite(item.trim_end_ms) ? Math.round(item.trim_end_ms) : null;
      if (trimStart !== null && trimEnd !== null) {
        // keep it valid: end after start, never longer than 60s
        trimEnd = Math.min(Math.max(trimEnd, trimStart + 1000), trimStart + 60000);
      }

      let crop = null;
      const c = item.crop;
      if (isVideo && c && [c.x, c.y, c.w, c.h].every(Number.isFinite)) {
        const x = Math.min(Math.max(c.x, 0), 1);
        const y = Math.min(Math.max(c.y, 0), 1);
        crop = {
          x,
          y,
          w: Math.min(Math.max(c.w, 0.05), 1 - x),
          h: Math.min(Math.max(c.h, 0.05), 1 - y),
          fa: Number.isFinite(c.fa) && c.fa > 0 ? c.fa : null,
        };
      }

      let textOverlay = null;
      const o = item.text_overlay;
      if (o && typeof o.text === 'string' && o.text.trim() && Number.isFinite(o.y)) {
        textOverlay = { text: o.text.trim().slice(0, 200), y: Math.min(Math.max(o.y, 0), 1) };
      }

      // Product tag card — only the product's own seller may tag it
      let productTag = null;
      const t = item.product_tag;
      if (t && t.product_id && [t.x, t.y, t.rot].every(Number.isFinite)) {
        const own = await pool.query(
          'SELECT 1 FROM products WHERE id = $1 AND seller_id = $2',
          [t.product_id, req.userId]
        );
        if (own.rows.length > 0) {
          productTag = {
            product_id: String(t.product_id),
            title: String(t.title || '').slice(0, 80),
            price: Number.isFinite(Number(t.price)) ? Number(t.price) : 0,
            image: typeof t.image === 'string' ? t.image : null,
            x: Math.min(Math.max(t.x, 0), 1),
            y: Math.min(Math.max(t.y, 0), 1),
            rot: Math.min(Math.max(t.rot, -360), 360),
          };
        }
      }

      const { rows } = await pool.query(
        `INSERT INTO stories (user_id, media_url, media_type, caption, content_type, trim_start_ms, trim_end_ms, kind, crop, product_tag, text_overlay, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb,
           CASE WHEN $8 = 'spotlight' THEN NOW() + INTERVAL '100 years' ELSE NOW() + INTERVAL '24 hours' END)
         RETURNING *`,
        [
          req.userId, item.media_url, item.media_type, item.caption || null,
          ALLOWED_TAGS.includes(item.content_type) ? item.content_type : null,
          trimStart, trimEnd, kind, crop ? JSON.stringify(crop) : null,
          productTag ? JSON.stringify(productTag) : null,
          textOverlay ? JSON.stringify(textOverlay) : null,
        ]
      );
      inserted.push(rows[0]);
    }
    res.status(201).json(inserted);
    notifyFollowersOfPost(req.userId, inserted[0].id, kind);
    pool.query('SELECT name FROM users WHERE id = $1', [req.userId]).then(({ rows: [u] }) => {
      inserted
        .filter((r) => r.media_type === 'video')
        .forEach((r) => ensureWatermarked({ ...r, owner_name: u?.name }).catch(() => {}));
    }).catch(() => {});
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
    const ins = await pool.query(
      `INSERT INTO story_likes (story_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING story_id`,
      [req.params.id, req.userId]
    );
    if (ins.rowCount > 0) notifyStoryLike(req.params.id, req.userId);
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
// POST /api/stories/:id/repost — not your own post
router.post('/:id/repost', requireAuth, async (req, res) => {
  try {
    const { rows: [s] } = await pool.query('SELECT user_id FROM stories WHERE id = $1', [req.params.id]);
    if (!s) return res.status(404).json({ error: 'Story not found' });
    const ins = await pool.query(
      `INSERT INTO story_reposts (story_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING story_id`,
      [req.params.id, req.userId]
    );
    if (ins.rowCount > 0) notifyStoryRepost(req.params.id, req.userId);
    res.json(await repostSummary(req.params.id));
  } catch (err) {
    console.error('Repost error:', err);
    res.status(500).json({ error: 'Failed to repost' });
  }
});

// DELETE /api/stories/:id/repost
router.delete('/:id/repost', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM story_reposts WHERE story_id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    res.json(await repostSummary(req.params.id));
  } catch (err) {
    console.error('Unrepost error:', err);
    res.status(500).json({ error: 'Failed to remove repost' });
  }
});

// GET /api/stories/:id/comments
router.get('/:id/comments', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.text, c.created_at, c.user_id, c.parent_id,
              u.name AS user_name, u.avatar_url AS user_avatar,
              (SELECT COUNT(*)::int FROM story_comments r WHERE r.parent_id = c.id) AS reply_count,
              (SELECT COUNT(*)::int FROM story_comment_likes cl WHERE cl.comment_id = c.id) AS like_count,
              EXISTS (SELECT 1 FROM story_comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $2) AS liked,
              c.pinned
       FROM story_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.story_id = $1 AND c.parent_id IS NULL
       ORDER BY c.pinned DESC, c.created_at DESC
       LIMIT 100`,
      [req.params.id, req.userId]
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
              u.name AS user_name, u.avatar_url AS user_avatar,
              (SELECT COUNT(*)::int FROM story_comment_likes cl WHERE cl.comment_id = c.id) AS like_count,
              EXISTS (SELECT 1 FROM story_comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $3) AS liked
       FROM story_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.story_id = $1 AND c.parent_id = $2
       ORDER BY c.created_at ASC
       LIMIT 100`,
      [req.params.id, req.params.commentId, req.userId]
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
    const { rows: [cs] } = await pool.query('SELECT comments_off, user_id FROM stories WHERE id = $1', [req.params.id]);
    if (cs?.comments_off && String(cs.user_id) !== String(req.userId)) return res.status(403).json({ error: 'Comments are turned off' });

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
    notifyStoryComment(req.params.id, req.userId, text, !!parentId);
  } catch (err) {
    console.error('Post comment error:', err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});
// POST /api/stories/:id/comments/:commentId/like
router.post('/:id/comments/:commentId/like', requireAuth, async (req, res) => {
  try {
    const exists = await pool.query(
      'SELECT 1 FROM story_comments WHERE id = $1 AND story_id = $2',
      [req.params.commentId, req.params.id]
    );
    if (exists.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    const ins = await pool.query(
      `INSERT INTO story_comment_likes (comment_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING comment_id`,
      [req.params.commentId, req.userId]
    );
    if (ins.rowCount > 0) notifyCommentLike(req.params.id, req.params.commentId, req.userId);
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS like_count FROM story_comment_likes WHERE comment_id = $1',
      [req.params.commentId]
    );
    res.json({ liked: true, like_count: rows[0].like_count });
  } catch (err) {
    console.error('Like comment error:', err);
    res.status(500).json({ error: 'Failed to like comment' });
  }
});

// DELETE /api/stories/:id/comments/:commentId/like
router.delete('/:id/comments/:commentId/like', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM story_comment_likes WHERE comment_id = $1 AND user_id = $2',
      [req.params.commentId, req.userId]
    );
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS like_count FROM story_comment_likes WHERE comment_id = $1',
      [req.params.commentId]
    );
    res.json({ liked: false, like_count: rows[0].like_count });
  } catch (err) {
    console.error('Unlike comment error:', err);
    res.status(500).json({ error: 'Failed to unlike comment' });
  }
});

// POST /api/stories/:id/hide — "Not interested"
router.post('/:id/hide', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO story_hidden (user_id, story_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.userId, req.params.id]
    );
    res.sendStatus(204);
  } catch (err) {
    console.error('Hide story error:', err);
    res.status(500).json({ error: 'Failed to hide post' });
  }
});

// POST /api/stories/block/:userId
router.post('/block/:userId', requireAuth, async (req, res) => {
  try {
    if (String(req.params.userId) === String(req.userId)) {
      return res.status(400).json({ error: "You can't block yourself" });
    }
    await pool.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.userId, req.params.userId]
    );
    res.sendStatus(204);
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// DELETE /api/stories/block/:userId
router.delete('/block/:userId', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.userId, req.params.userId]);
    res.sendStatus(204);
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// PATCH /api/stories/:id/comments/:commentId/pin — owner only, one pinned at a time
router.patch('/:id/comments/:commentId/pin', requireAuth, async (req, res) => {
  try {
    const { rows: [s] } = await pool.query('SELECT user_id FROM stories WHERE id = $1', [req.params.id]);
    if (!s) return res.status(404).json({ error: 'Story not found' });
    if (String(s.user_id) !== String(req.userId)) return res.status(403).json({ error: 'Only the owner can pin' });
    const pin = !!req.body.pinned;
    if (pin) {
      const c = await pool.query(
        'SELECT 1 FROM story_comments WHERE id = $1 AND story_id = $2 AND parent_id IS NULL',
        [req.params.commentId, req.params.id]
      );
      if (c.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    }
    await pool.query('UPDATE story_comments SET pinned = false WHERE story_id = $1', [req.params.id]);
    if (pin) {
      await pool.query('UPDATE story_comments SET pinned = true WHERE id = $1', [req.params.commentId]);
    }
    res.sendStatus(204);
  } catch (err) {
    console.error('Pin comment error:', err);
    res.status(500).json({ error: 'Failed to pin comment' });
  }
});

// PATCH /api/stories/:id/comments-off — owner only
router.patch('/:id/comments-off', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE stories SET comments_off = $3 WHERE id = $1 AND user_id = $2 RETURNING comments_off',
      [req.params.id, req.userId, !!req.body.off]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Story not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Comments toggle error:', err);
    res.status(500).json({ error: 'Failed to update comments' });
  }
});

// POST /api/stories/:id/report
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    const reason = String(req.body.reason || '').trim().slice(0, 100);
    if (!reason) return res.status(400).json({ error: 'Reason is required' });
    const { rows: [s] } = await pool.query('SELECT user_id FROM stories WHERE id = $1', [req.params.id]);
    if (!s) return res.status(404).json({ error: 'Story not found' });
    if (String(s.user_id) === String(req.userId)) {
      return res.status(400).json({ error: "You can't report your own post" });
    }
    await pool.query(
      `INSERT INTO story_reports (story_id, reporter_id, reason) VALUES ($1, $2, $3)
       ON CONFLICT (story_id, reporter_id) DO UPDATE SET reason = EXCLUDED.reason`,
      [req.params.id, req.userId, reason]
    );
    res.sendStatus(204);
  } catch (err) {
    console.error('Report story error:', err);
    res.status(500).json({ error: 'Failed to send report' });
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