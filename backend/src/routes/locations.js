const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/locations/mine — buyer's saved delivery locations, default first
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, location, is_default, created_at
             FROM buyer_delivery_locations
             WHERE buyer_id = $1
             ORDER BY is_default DESC, created_at ASC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get locations error:', err);
        res.status(500).json({ error: 'Failed to fetch delivery locations' });
    }
});

// POST /api/locations — add a new saved location. The very first one a buyer
// adds automatically becomes the default; later ones don't, until the buyer
// explicitly sets a different default.
router.post('/', requireAuth, async (req, res) => {
    const { location } = req.body;
    if (!location || !location.trim()) {
        return res.status(400).json({ error: 'Location is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const countResult = await client.query(
            'SELECT COUNT(*) FROM buyer_delivery_locations WHERE buyer_id = $1',
            [req.userId]
        );
        const isFirst = parseInt(countResult.rows[0].count, 10) === 0;

        const result = await client.query(
            `INSERT INTO buyer_delivery_locations (buyer_id, location, is_default)
             VALUES ($1, $2, $3) RETURNING *`,
            [req.userId, location.trim(), isFirst]
        );

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Add location error:', err);
        res.status(500).json({ error: 'Failed to add location' });
    } finally {
        client.release();
    }
});

// PATCH /api/locations/default/:id — set as the single default. Only one
// location can ever be default at a time (single-select, mirrors payout accounts).
router.patch('/default/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const check = await client.query(
            'SELECT id FROM buyer_delivery_locations WHERE id = $1 AND buyer_id = $2',
            [id, req.userId]
        );
        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Location not found' });
        }

        await client.query(
            'UPDATE buyer_delivery_locations SET is_default = false WHERE buyer_id = $1',
            [req.userId]
        );
        await client.query(
            'UPDATE buyer_delivery_locations SET is_default = true WHERE id = $1',
            [id]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Set default location error:', err);
        res.status(500).json({ error: 'Failed to set default location' });
    } finally {
        client.release();
    }
});

// DELETE /api/locations/:id
router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const check = await client.query(
            'SELECT id, is_default FROM buyer_delivery_locations WHERE id = $1 AND buyer_id = $2',
            [id, req.userId]
        );
        const loc = check.rows[0];
        if (!loc) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Location not found' });
        }

        await client.query('DELETE FROM buyer_delivery_locations WHERE id = $1', [id]);

        if (loc.is_default) {
            await client.query(
                `UPDATE buyer_delivery_locations SET is_default = true
                 WHERE id = (
                     SELECT id FROM buyer_delivery_locations
                     WHERE buyer_id = $1
                     ORDER BY created_at ASC
                     LIMIT 1
                 )`,
                [req.userId]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete location error:', err);
        res.status(500).json({ error: 'Failed to delete location' });
    } finally {
        client.release();
    }
});

module.exports = router;