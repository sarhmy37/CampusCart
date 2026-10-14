const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { normalize } = require('../utils/serviceTypes');

const router = express.Router();

// GET /api/service-types — approved types, most used first
router.get('/', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT st.id, st.label, COUNT(p.id)::int AS listing_count
             FROM service_types st
             LEFT JOIN products p ON p.service_type_id = st.id
             WHERE st.status = 'approved' AND st.canonical_id IS NULL
             GROUP BY st.id
             ORDER BY listing_count DESC, st.label ASC`
        );
        res.json(r.rows);
    } catch (err) {
        console.error('List service types error:', err);
        res.status(500).json({ error: 'Could not load service types' });
    }
});

// GET /api/service-types/search?q=
router.get('/search', async (req, res) => {
    const n = normalize(req.query.q);
    if (n.length < 2) return res.json([]);
    try {
        const r = await pool.query(
            `SELECT COALESCE(c.id, st.id) AS id, COALESCE(c.label, st.label) AS label,
                    similarity(st.normalized, $1) AS score
             FROM service_types st
             LEFT JOIN service_types c ON c.id = st.canonical_id
             WHERE st.normalized % $1 OR st.normalized ILIKE $2
             ORDER BY score DESC
             LIMIT 10`,
            [n, `%${n}%`]
        );
        const seen = new Set();
        res.json(r.rows.filter((x) => !seen.has(x.id) && seen.add(x.id)).slice(0, 6));
    } catch (err) {
        console.error('Search service types error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// POST /api/service-types — reuse an exact match or create a pending type
router.post('/', requireAuth, async (req, res) => {
    const label = String(req.body.label || '').trim().slice(0, 60);
    const n = normalize(label);
    if (n.length < 2) return res.status(400).json({ error: 'Enter a valid service type' });
    try {
        const existing = await pool.query(
            `SELECT COALESCE(c.id, st.id) AS id, COALESCE(c.label, st.label) AS label
             FROM service_types st
             LEFT JOIN service_types c ON c.id = st.canonical_id
             WHERE st.normalized = $1`,
            [n]
        );
        if (existing.rows[0]) return res.json(existing.rows[0]);

        const created = await pool.query(
            `INSERT INTO service_types (label, normalized, status) VALUES ($1, $2, 'pending')
             ON CONFLICT (normalized) DO UPDATE SET normalized = EXCLUDED.normalized
             RETURNING id, label`,
            [label, n]
        );
        res.status(201).json(created.rows[0]);
    } catch (err) {
        console.error('Create service type error:', err);
        res.status(500).json({ error: 'Could not save service type' });
    }
});

module.exports = router;