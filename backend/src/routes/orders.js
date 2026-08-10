const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PLATFORM_FEE_RATE = 0.05; // 5%
const DELIVERY_FEE = 15;

// POST /api/orders — checkout the cart
// Body: { items: [{ product_id, quantity }], delivery_method: 'pickup' | 'delivery' }
router.post('/', requireAuth, async (req, res) => {
    const { items, delivery_method } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let subtotal = 0;
        const lineItems = [];

        for (const { product_id, quantity } of items) {
            const qty = Number(quantity) || 1;

            const productResult = await client.query(
                'SELECT id, title, price, stock, seller_id FROM products WHERE id = $1 FOR UPDATE',
                [product_id]
            );
            const product = productResult.rows[0];
            if (!product) throw { status: 404, message: `A product in your cart no longer exists` };
            if (product.stock < qty) throw { status: 400, message: `Not enough stock for "${product.title}"` };

            const lineTotal = parseFloat(product.price) * qty;
            const platformFee = Math.round(lineTotal * PLATFORM_FEE_RATE * 100) / 100;
            const sellerEarnings = Math.round((lineTotal - platformFee) * 100) / 100;

            subtotal += lineTotal;
            lineItems.push({
                product_id: product.id,
                seller_id: product.seller_id,
                title: product.title,
                quantity: qty,
                price_at_purchase: product.price,
                platform_fee: platformFee,
                seller_earnings: sellerEarnings,
            });

            await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [qty, product.id]);
        }

        const deliveryFee = delivery_method === 'delivery' ? DELIVERY_FEE : 0;
        const totalAmount = subtotal + deliveryFee;

        const orderResult = await client.query(
            `INSERT INTO orders (buyer_id, status, delivery_method, subtotal, delivery_fee, total_amount, completed_at)
             VALUES ($1, 'completed', $2, $3, $4, $5, now())
             RETURNING id`,
            [req.userId, delivery_method || 'pickup', subtotal, deliveryFee, totalAmount]
        );
        const orderId = orderResult.rows[0].id;

        for (const item of lineItems) {
            await client.query(
                `INSERT INTO order_items
                    (order_id, product_id, seller_id, title, quantity, price_at_purchase, platform_fee, seller_earnings, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed')`,
                [orderId, item.product_id, item.seller_id, item.title, item.quantity, item.price_at_purchase, item.platform_fee, item.seller_earnings]
            );
        }

        await client.query('COMMIT');

        // Credit any newly-earned seller rewards now that these sales are completed.
        const { checkAndCreditRewards } = require('./sellers');
        const uniqueSellerIds = [...new Set(lineItems.map((i) => i.seller_id))];
        for (const sellerId of uniqueSellerIds) {
            await checkAndCreditRewards(sellerId).catch((e) => console.error('Reward check error:', e));
        }

        res.status(201).json({ id: orderId, subtotal, delivery_fee: deliveryFee, total_amount: totalAmount });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create order error:', err);
        res.status(err.status || 500).json({ error: err.message || 'Something went wrong placing your order' });
    } finally {
        client.release();
    }
});

// GET /api/orders/mine?period=week|month|6months|year|all — buyer's own orders, with items
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const periodMap = {
            week: "created_at >= now() - interval '7 days'",
            month: "created_at >= now() - interval '1 month'",
            '6months': "created_at >= now() - interval '6 months'",
            year: "created_at >= now() - interval '1 year'",
        };
        const dateFilter = periodMap[req.query.period] || '1=1';

        const ordersResult = await pool.query(
            `SELECT * FROM orders WHERE buyer_id = $1 AND ${dateFilter} ORDER BY created_at DESC`,
            [req.userId]
        );
        const orders = ordersResult.rows;

        for (const order of orders) {
            const itemsResult = await pool.query(
                'SELECT id, title, quantity, price_at_purchase FROM order_items WHERE order_id = $1',
                [order.id]
            );
            order.items = itemsResult.rows;
        }

        res.json(orders);
    } catch (err) {
        console.error('Get my orders error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your orders' });
    }
});

// GET /api/orders/sales — seller's sold items, with fee breakdown and reward attribution
router.get('/sales', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `WITH numbered AS (
                SELECT oi.*, o.created_at, o.status AS order_status, u.name AS buyer_name,
                       CASE WHEN oi.status = 'completed'
                            THEN ROW_NUMBER() OVER (
                                PARTITION BY oi.seller_id, oi.status
                                ORDER BY o.created_at ASC
                            )
                       END AS completed_rank
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                JOIN users u ON u.id = o.buyer_id
                WHERE oi.seller_id = $1
             )
             SELECT numbered.*,
                    CEIL(completed_rank::numeric / 30) AS milestone_batch
             FROM numbered
             ORDER BY created_at DESC`,
            [req.userId]
        );

        const rewardsResult = await pool.query(
            'SELECT milestone FROM seller_rewards WHERE seller_id = $1 AND credited = TRUE',
            [req.userId]
        );
        const creditedMilestones = new Set(rewardsResult.rows.map((r) => r.milestone));

        const rows = result.rows.map((row) => ({
            ...row,
            reward_contributed: row.milestone_batch
                ? creditedMilestones.has(row.milestone_batch * 30)
                : false,
        }));

        res.json(rows);
    } catch (err) {
        console.error('Get sales error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your sales' });
    }
});

module.exports = router;