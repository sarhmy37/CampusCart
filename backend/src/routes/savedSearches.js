const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { isPlanActive } = require('../utils/plans');

const router = express.Router();

const MAX_SAVED_SEARCHES = 20;

async function requireActivePlan(req, res, next) {
    try {
        const result = await pool.query('SELECT plan, plan_expires_at FROM users WHERE id = $1', [req.userId]);
        const user = result.rows[0];
        if (!user || !isPlanActive(user.plan, user.plan_expires_at)) {
            return res.status(403).json({
                error: 'Saved searches are a Pro/Premium perk. Upgrade your plan to save searches and get notified of new matches.',
            });
        }
        next();
    } catch (err) {
        console.error('Plan check error:', err);
        res.status(500).json({ error: 'Something went wrong checking your plan' });
    }
}

// GET /api/saved-searches/mine
router.get('/mine', requireAuth, requireActivePlan, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM saved_searches WHERE buyer_id = $1 ORDER BY created_at DESC',
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get saved searches error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your saved searches' });
    }
});

// POST /api/saved-searches
router.post('/', requireAuth, requireActivePlan, async (req, res) => {
    const {
        keyword, category, school,
        price_min, price_max, verified_only, filter_type, service_type,
    } = req.body;

    if (!keyword && !category && !school) {
        return res.status(400).json({ error: 'Add at least a keyword, category, or school to save this search' });
    }

    try {
        const countResult = await pool.query('SELECT COUNT(*) FROM saved_searches WHERE buyer_id = $1', [req.userId]);
        if (parseInt(countResult.rows[0].count, 10) >= MAX_SAVED_SEARCHES) {
            return res.status(403).json({ error: `You can save up to ${MAX_SAVED_SEARCHES} searches` });
        }

        const result = await pool.query(
            `INSERT INTO saved_searches
                (buyer_id, keyword, category, school, price_min, price_max, verified_only, filter_type, service_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                req.userId,
                keyword || null,
                category || null,
                school || null,
                price_min ?? null,
                price_max ?? null,
                verified_only || false,
                filter_type || null,
                service_type || null,
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Save search error:', err);
        res.status(500).json({ error: 'Something went wrong saving this search' });
    }
});

// DELETE /api/saved-searches/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM saved_searches WHERE id = $1 AND buyer_id = $2 RETURNING id',
            [req.params.id, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Saved search not found' });
        res.json({ message: 'Saved search deleted' });
    } catch (err) {
        console.error('Delete saved search error:', err);
        res.status(500).json({ error: 'Something went wrong deleting this search' });
    }
});

module.exports = router;