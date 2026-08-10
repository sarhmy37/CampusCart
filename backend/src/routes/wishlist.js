const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/wishlist — full product details for everything the user has wishlisted
router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.id, p.title, p.price, p.condition, p.primary_image, p.stock,
                    c.name AS category, u.name AS seller_name, u.verified AS seller_verified,
                    w.created_at AS wishlisted_at
             FROM wishlist_items w
             JOIN products p ON p.id = w.product_id
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN users u ON u.id = p.seller_id
             WHERE w.user_id = $1
             ORDER BY w.created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get wishlist error:', err);
        res.status(500).json({ error: 'Something went wrong loading your wishlist' });
    }
});

// POST /api/wishlist — body: { product_id }
router.post('/', requireAuth, async (req, res) => {
    const { product_id } = req.body;
    if (!product_id) {
        return res.status(400).json({ error: 'product_id is required' });
    }

    try {
        await pool.query(
            `INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2)
             ON CONFLICT (user_id, product_id) DO NOTHING`,
            [req.userId, product_id]
        );
        res.status(201).json({ message: 'Added to wishlist' });
    } catch (err) {
        console.error('Add to wishlist error:', err);
        res.status(500).json({ error: 'Something went wrong adding to your wishlist' });
    }
});

// DELETE /api/wishlist/:productId
router.delete('/:productId', requireAuth, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2',
            [req.userId, req.params.productId]
        );
        res.json({ message: 'Removed from wishlist' });
    } catch (err) {
        console.error('Remove from wishlist error:', err);
        res.status(500).json({ error: 'Something went wrong removing that item' });
    }
});

module.exports = router;