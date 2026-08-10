const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/categories
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name FROM categories ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Get categories error:', err);
        res.status(500).json({ error: 'Something went wrong fetching categories' });
    }
});

module.exports = router;