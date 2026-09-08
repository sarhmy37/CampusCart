const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Middleware: only the current exclusive data seller can manage bundles
async function requireDataSeller(req, res, next) {
    try {
        const result = await pool.query('SELECT is_data_seller FROM users WHERE id = $1', [req.userId]);
        if (!result.rows[0]?.is_data_seller) {
            return res.status(403).json({ error: 'You are not authorized to sell Mobile Data' });
        }
        next();
    } catch (err) {
        console.error('Data seller check error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
}

// GET /api/data-bundles/mine — the current data seller's own bundles (all, including inactive)
router.get('/mine', requireAuth, requireDataSeller, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM data_bundles WHERE seller_id = $1 ORDER BY network, gb_amount ASC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get my bundles error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your bundles' });
    }
});

// POST /api/data-bundles — add a new bundle
router.post('/', requireAuth, requireDataSeller, async (req, res) => {
    const { network, gb_amount, price } = req.body;
    if (!network || !gb_amount || !price) {
        return res.status(400).json({ error: 'Network, GB amount, and price are required' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO data_bundles (seller_id, network, gb_amount, price) VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.userId, network, gb_amount, price]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Add bundle error:', err);
        res.status(500).json({ error: 'Something went wrong adding this bundle' });
    }
});

// PATCH /api/data-bundles/:id — edit a bundle
router.patch('/:id', requireAuth, requireDataSeller, async (req, res) => {
    const { network, gb_amount, price, active } = req.body;
    try {
        const existing = await pool.query('SELECT seller_id FROM data_bundles WHERE id = $1', [req.params.id]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Bundle not found' });
        if (existing.rows[0].seller_id !== req.userId) return res.status(403).json({ error: "You can't edit someone else's bundle" });

        const result = await pool.query(
            `UPDATE data_bundles SET
                network = COALESCE($1, network),
                gb_amount = COALESCE($2, gb_amount),
                price = COALESCE($3, price),
                active = COALESCE($4, active)
             WHERE id = $5 RETURNING *`,
            [network, gb_amount, price, active, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update bundle error:', err);
        res.status(500).json({ error: 'Something went wrong updating this bundle' });
    }
});

// DELETE /api/data-bundles/:id
router.delete('/:id', requireAuth, requireDataSeller, async (req, res) => {
    try {
        const existing = await pool.query('SELECT seller_id FROM data_bundles WHERE id = $1', [req.params.id]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Bundle not found' });
        if (existing.rows[0].seller_id !== req.userId) return res.status(403).json({ error: "You can't delete someone else's bundle" });

        await pool.query('DELETE FROM data_bundles WHERE id = $1', [req.params.id]);
        res.json({ message: 'Bundle removed' });
    } catch (err) {
        console.error('Delete bundle error:', err);
        res.status(500).json({ error: 'Something went wrong removing this bundle' });
    }
});

// GET /api/data-bundles/browse?network=MTN — public: active bundles for a given network,
// from whichever seller currently holds is_data_seller (there's only ever one).
router.get('/browse', async (req, res) => {
    const { network } = req.query;
    if (!network) return res.status(400).json({ error: 'Network is required' });

    try {
        const result = await pool.query(
            `SELECT db.id, db.network, db.gb_amount, db.price, db.seller_id
             FROM data_bundles db
             JOIN users u ON u.id = db.seller_id
             WHERE db.network = $1 AND db.active = true AND u.is_data_seller = true
             ORDER BY db.gb_amount ASC`,
            [network]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Browse bundles error:', err);
        res.status(500).json({ error: 'Something went wrong fetching bundles' });
    }
});

module.exports = router;