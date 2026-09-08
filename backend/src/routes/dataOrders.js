const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Helper: insert a notification (mirrors the pattern in orders.js)
async function insertNotification(userId, type, message, relatedId = null, link = null) {
    await pool.query(
        `INSERT INTO notifications (user_id, type, message, related_id, link) VALUES ($1, $2, $3, $4, $5)`,
        [userId, type, message, relatedId, link]
    );
}

// POST /api/data-orders — buyer places a data order
router.post('/', requireAuth, async (req, res) => {
    const { bundle_id, momo_number } = req.body;
    if (!bundle_id || !momo_number) {
        return res.status(400).json({ error: 'Bundle and mobile money number are required' });
    }

    try {
        const bundleResult = await pool.query(
            `SELECT db.*, u.is_data_seller
             FROM data_bundles db
             JOIN users u ON u.id = db.seller_id
             WHERE db.id = $1 AND db.active = true`,
            [bundle_id]
        );
        const bundle = bundleResult.rows[0];
        if (!bundle || !bundle.is_data_seller) {
            return res.status(404).json({ error: 'This bundle is no longer available' });
        }

        const result = await pool.query(
            `INSERT INTO data_orders (buyer_id, seller_id, bundle_id, network, gb_amount, price, buyer_momo_number, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
             RETURNING *`,
            [req.userId, bundle.seller_id, bundle.id, bundle.network, bundle.gb_amount, bundle.price, momo_number]
        );
        const order = result.rows[0];

        await insertNotification(
            bundle.seller_id,
            'new_data_order',
            `A buyer ordered ${parseFloat(bundle.gb_amount)}GB (${bundle.network}) for GHS ${parseFloat(bundle.price).toFixed(2)}. Check your Deliveries tab.`,
            order.id,
            '/dashboard?tab=deliveries'
        );

        res.status(201).json(order);
    } catch (err) {
        console.error('Create data order error:', err);
        res.status(500).json({ error: 'Something went wrong placing your order' });
    }
});

// GET /api/data-orders/mine — buyer's own data orders
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM data_orders WHERE buyer_id = $1 ORDER BY created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get my data orders error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your data orders' });
    }
});

// GET /api/data-orders/pending — seller's pending data orders to deliver
router.get('/pending', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT dord.*, u.name AS buyer_name
             FROM data_orders dord
             JOIN users u ON u.id = dord.buyer_id
             WHERE dord.seller_id = $1 AND dord.status = 'pending'
             ORDER BY dord.created_at ASC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get pending data orders error:', err);
        res.status(500).json({ error: 'Something went wrong fetching pending data orders' });
    }
});

// POST /api/data-orders/:id/mark-delivered — seller marks as delivered
router.post('/:id/mark-delivered', requireAuth, async (req, res) => {
    try {
        const existing = await pool.query('SELECT * FROM data_orders WHERE id = $1', [req.params.id]);
        const order = existing.rows[0];
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.seller_id !== req.userId) return res.status(403).json({ error: "You can't update someone else's order" });
        if (order.status !== 'pending') return res.status(400).json({ error: 'This order has already been processed' });

        await pool.query(
            `UPDATE data_orders SET status = 'delivered', delivered_at = now() WHERE id = $1`,
            [req.params.id]
        );

        await insertNotification(
            order.buyer_id,
            'data_order_delivered',
            `Your ${parseFloat(order.gb_amount)}GB (${order.network}) data order has been delivered.`,
            order.id,
            '/dashboard?tab=orders'
        );

        res.json({ message: 'Marked as delivered' });
    } catch (err) {
        console.error('Mark data order delivered error:', err);
        res.status(500).json({ error: 'Something went wrong marking this order as delivered' });
    }
});

module.exports = router;