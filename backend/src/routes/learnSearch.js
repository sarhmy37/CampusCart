const express = require('express');
const router = express.Router();
const pool = require('../db/pool');                          // adjust to your pool import
const { requireAuth } = require('../middleware/auth');

const LIMIT = 100;
const dayKey = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const decode = (s = '') =>
  s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
   .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function usedToday() {
  const r = await pool.query('SELECT used FROM learn_search_quota WHERE day = $1', [dayKey()]);
  return r.rows[0]?.used || 0;
}

router.get('/quota', requireAuth, async (req, res) => {
  res.json({ used: await usedToday(), limit: LIMIT });
});

router.get('/search', requireAuth, async (req, res) => {
  const key = norm(String(req.query.q || '').slice(0, 100));
  if (key.length < 2) return res.status(400).json({ error: 'Search is too short' });

  try {
    // 1) cached? free, and shared by every student (kept 30 days, within YouTube's storage limit)
    const hit = await pool.query(
      `SELECT results FROM learn_search_cache
       WHERE query = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [key]
    );
    if (hit.rows[0]) {
      return res.json({ results: hit.rows[0].results, cached: true, used: await usedToday() });
    }

    // 2) reserve one of today's 100 slots (atomic, so two people can't overshoot)
    const slot = await pool.query(
      `INSERT INTO learn_search_quota (day, used) VALUES ($1, 1)
       ON CONFLICT (day) DO UPDATE SET used = learn_search_quota.used + 1
       WHERE learn_search_quota.used < $2
       RETURNING used`,
      [dayKey(), LIMIT]
    );
    if (!slot.rows[0]) return res.status(429).json({ error: 'Daily limit reached', used: LIMIT });

    // 3) ask YouTube
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.search = new URLSearchParams({
      part: 'snippet', type: 'video', maxResults: '15', videoEmbeddable: 'true',
      safeSearch: 'strict', q: key, key: process.env.YOUTUBE_API_KEY,
    }).toString();
    const yt = await fetch(url);

    if (!yt.ok) {
      if (yt.status === 403) {
        await pool.query('UPDATE learn_search_quota SET used = $2 WHERE day = $1', [dayKey(), LIMIT]);
        return res.status(429).json({ error: 'Daily limit reached', used: LIMIT });
      }
      await pool.query('UPDATE learn_search_quota SET used = GREATEST(used - 1, 0) WHERE day = $1', [dayKey()]);
      return res.status(502).json({ error: 'YouTube search failed' });
    }

    const data = await yt.json();
    const results = (data.items || [])
      .filter((it) => it.id?.videoId)
      .map((it) => ({
        video_id: it.id.videoId,
        title: decode(it.snippet.title),
        thumbnail: `https://i.ytimg.com/vi/${it.id.videoId}/hqdefault.jpg`,
        channel: decode(it.snippet.channelTitle),
        published_at: it.snippet.publishedAt || '',
      }));

    await pool.query(
      `INSERT INTO learn_search_cache (query, results) VALUES ($1, $2)
       ON CONFLICT (query) DO UPDATE SET results = $2, created_at = NOW()`,
      [key, JSON.stringify(results)]
    );
    res.json({ results, cached: false, used: await usedToday() });
  } catch (e) {
    console.log('LEARN SEARCH ERROR', e.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;