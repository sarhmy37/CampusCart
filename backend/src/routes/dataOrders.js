const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction } = require('../utils/paystack');

const router = express.Router();

// Helper: insert a notification (mirrors the pattern in orders.js)
const { insertNotification } = require('../utils/notifications');

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

        const buyerResult = await pool.query(
            `SELECT personal_email, university_email FROM users WHERE id = $1`,
            [req.userId]
        );
        const buyerEmail = buyerResult.rows[0]?.personal_email || buyerResult.rows[0]?.university_email;
        if (!buyerEmail) {
            return res.status(400).json({ error: 'Please add an email address before placing a data order' });
        }

        const result = await pool.query(
            `INSERT INTO data_orders (buyer_id, seller_id, bundle_id, network, gb_amount, price, buyer_momo_number, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'awaiting_payment')
             RETURNING *`,
            [req.userId, bundle.seller_id, bundle.id, bundle.network, bundle.gb_amount, bundle.price, momo_number]
        );
        const order = result.rows[0];

        const reference = `data_${order.id}`;
        try {
            const paystackRes = await initializeTransaction({
                email: buyerEmail,
                amountGHS: parseFloat(bundle.price),
                reference,
                callback_url: `https://campuscart-tdfn.onrender.com/paystack/callback?data_ref=${reference}`,
                cancel_action: 'https://campuscart-tdfn.onrender.com/paystack/callback?status=cancel',
                metadata: { data_order_id: order.id, buyer_id: req.userId, bundle_id: bundle.id },
            });

            res.status(201).json({
                id: order.id,
                amount: parseFloat(bundle.price),
                authorization_url: paystackRes.data.authorization_url,
            });
        } catch (paymentError) {
            await pool.query(`DELETE FROM data_orders WHERE id = $1 AND status = 'awaiting_payment'`, [order.id]);
            throw paymentError;
        }
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

// GET /api/data-orders/status/:id — buyer checks payment/fulfillment state
router.get('/status/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, status, delivered_at FROM data_orders WHERE id = $1 AND buyer_id = $2`,
            [req.params.id, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Data order not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get data order status error:', err);
        res.status(500).json({ error: 'Failed to check data order status' });
    }
});

// POST /api/data-orders/:id/mark-delivered — seller marks as delivered
router.post('/:id/mark-delivered', requireAuth, async (req, res) => {
    try {
        const existing = await pool.query('SELECT * FROM data_orders WHERE id = $1', [req.params.id]);
        const order = existing.rows[0];
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.seller_id !== req.userId) return res.status(403).json({ error: "You can't update someone else's order" });
        if (order.status !== 'pending') return res.status(400).json({ error: 'This order is not ready to be delivered' });

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

async function processDataOrderWebhookEvent(event) {
    const reference = String(event.data?.reference || '');
    if (!reference.startsWith('data_')) return;

    const dataOrderId = event.data?.metadata?.data_order_id || reference.slice('data_'.length);
    const amountPaidGHS = Math.round((Number(event.data?.amount || 0) / 100) * 100) / 100;

    const result = await pool.query(
        `SELECT * FROM data_orders WHERE id = $1 AND status = 'awaiting_payment'`,
        [dataOrderId]
    );
    const order = result.rows[0];
    if (!order) return;

    const expectedGHS = parseFloat(order.price);
    if (Math.abs(amountPaidGHS - expectedGHS) > 0.05) {
        console.error(`[DATA ORDER AMOUNT MISMATCH] Order ${order.id}: expected GHS ${expectedGHS}, got GHS ${amountPaidGHS}`);
        await insertNotification(
            order.buyer_id,
            'payment_flagged',
            'Your data-order payment needs to be reviewed because the amount did not match the bundle price.',
            order.id,
            '/dashboard?tab=orders'
        );
        return;
    }

    await pool.query(
        `UPDATE data_orders SET status = 'pending' WHERE id = $1 AND status = 'awaiting_payment'`,
        [order.id]
    );

    await insertNotification(
        order.seller_id,
        'new_data_order',
        `A buyer ordered ${parseFloat(order.gb_amount)}GB (${order.network}) for GHS ${expectedGHS.toFixed(2)}. Check your Deliveries tab.`,
        order.id,
        '/dashboard?tab=deliveries'
    );
    await insertNotification(
        order.buyer_id,
        'data_order_payment_success',
        'Your data-order payment was successful. Your data will be delivered shortly.',
        order.id,
        '/dashboard?tab=orders'
    );
}

module.exports = router;
module.exports.processDataOrderWebhookEvent = processDataOrderWebhookEvent;