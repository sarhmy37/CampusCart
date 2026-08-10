const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction, verifyWebhookSignature, createTransferRecipient, initiateTransfer } = require('../utils/paystack');
const { sendOrderSMS } = require('../utils/mailer');
const { calcDeliveryFee } = require('../utils/distance');

const router = express.Router();

const BUYER_FEE_RATE = 0.02;
const SELLER_FEE_RATE = 0.02;

// POST /api/orders — create pending order + get Paystack payment link
router.post('/', requireAuth, async (req, res) => {
    const { items, delivery_method, buyer_lat, buyer_lng } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let subtotal = 0;
        const lineItems = [];
        const sellerSchools = {}; // seller_id -> school, collected as we go

        for (const { product_id, quantity } of items) {
            const qty = Number(quantity) || 1;

            const productResult = await client.query(
                `SELECT p.id, p.title, p.price, p.stock, p.seller_id, u.school
                 FROM products p JOIN users u ON u.id = p.seller_id
                 WHERE p.id = $1 FOR UPDATE OF p`,
                [product_id]
            );
            const product = productResult.rows[0];
            if (!product) throw { status: 404, message: 'A product in your cart no longer exists' };
            if (product.stock < qty) throw { status: 400, message: `Not enough stock for "${product.title}"` };

            sellerSchools[product.seller_id] = product.school;

            const lineTotal = parseFloat(product.price) * qty;
            const sellerFee = Math.round(lineTotal * SELLER_FEE_RATE * 100) / 100;
            const sellerEarnings = Math.round((lineTotal - sellerFee) * 100) / 100;

            subtotal += lineTotal;
            lineItems.push({
                product_id: product.id,
                seller_id: product.seller_id,
                title: product.title,
                quantity: qty,
                price_at_purchase: product.price,
                platform_fee: sellerFee,
                seller_earnings: sellerEarnings,
            });
        }

        // Delivery fee: computed server-side per seller, based on real distance —
        // never trust a client-supplied fee.
        let deliveryFee = 0;
        if (delivery_method === 'delivery') {
            for (const school of Object.values(sellerSchools)) {
                const { fee } = calcDeliveryFee(buyer_lat, buyer_lng, school);
                deliveryFee += fee;
            }
        }

        const buyerFee = Math.round(subtotal * BUYER_FEE_RATE * 100) / 100;
        const totalAmount = subtotal + deliveryFee + buyerFee;

        const orderResult = await client.query(
            `INSERT INTO orders (buyer_id, status, delivery_method, subtotal, delivery_fee, total_amount)
             VALUES ($1, 'pending', $2, $3, $4, $5)
             RETURNING id`,
            [req.userId, delivery_method || 'pickup', subtotal, deliveryFee, totalAmount]
        );
        const orderId = orderResult.rows[0].id;

        for (const item of lineItems) {
            await client.query(
                `INSERT INTO order_items
                    (order_id, product_id, seller_id, title, quantity, price_at_purchase, platform_fee, seller_earnings, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
                [orderId, item.product_id, item.seller_id, item.title, item.quantity, item.price_at_purchase, item.platform_fee, item.seller_earnings]
            );
        }

        const userResult = await client.query('SELECT university_email, personal_email FROM users WHERE id = $1', [req.userId]);
        const buyerEmail = userResult.rows[0]?.personal_email || userResult.rows[0]?.university_email;

        const reference = `cc_${orderId}`;
        await client.query('UPDATE orders SET payment_reference = $1 WHERE id = $2', [reference, orderId]);

        await client.query('COMMIT');

        const paystackRes = await initializeTransaction({
            email: buyerEmail,
            amountGHS: totalAmount,
            reference,
            callback_url: `${process.env.CORS_ORIGIN}/orders/${orderId}`,
            metadata: { order_id: orderId, buyer_id: req.userId },
        });

        res.status(201).json({
            id: orderId,
            subtotal,
            delivery_fee: deliveryFee,
            buyer_fee: buyerFee,
            total_amount: totalAmount,
            authorization_url: paystackRes.data.authorization_url,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create order error:', err);
        res.status(err.status || 500).json({ error: err.message || 'Something went wrong placing your order' });
    } finally {
        client.release();
    }
});

// POST /api/orders/webhook — Paystack calls this after payment
router.post('/webhook', async (req, res) => {
    const signature = req.headers['x-paystack-signature'];
    if (!verifyWebhookSignature(req.rawBody, signature)) {
        return res.status(401).send('Invalid signature');
    }

    const event = req.body;
    res.sendStatus(200); // acknowledge immediately, process after

    if (event.event !== 'charge.success') return;

    const reference = event.data.reference;

    try {
        const orderResult = await pool.query('SELECT * FROM orders WHERE payment_reference = $1', [reference]);
        const order = orderResult.rows[0];
        if (!order || order.status === 'completed') return; // already processed or not found

        await pool.query(
            `UPDATE orders SET status = 'completed', completed_at = now() WHERE id = $1`,
            [order.id]
        );
        await pool.query(
            `UPDATE order_items SET status = 'completed' WHERE order_id = $1`,
            [order.id]
        );

        // Reduce stock now that payment is confirmed
        const itemsResult = await pool.query('SELECT product_id, quantity, seller_id, seller_earnings, title FROM order_items WHERE order_id = $1', [order.id]);
        for (const item of itemsResult.rows) {
            await pool.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
        }

        // Group earnings by seller and pay out
        const sellerTotals = {};
        for (const item of itemsResult.rows) {
            sellerTotals[item.seller_id] = (sellerTotals[item.seller_id] || 0) + parseFloat(item.seller_earnings);
        }

        for (const [sellerId, amount] of Object.entries(sellerTotals)) {
            try {
                await payoutSeller(sellerId, amount, order.id);
            } catch (e) {
                console.error(`Payout failed for seller ${sellerId}:`, e.message);
            }
        }

        // Credit rewards
        const { checkAndCreditRewards } = require('./sellers');
        for (const sellerId of Object.keys(sellerTotals)) {
            await checkAndCreditRewards(sellerId).catch((e) => console.error('Reward check error:', e));
        }

        // SMS the buyer
        const buyerResult = await pool.query('SELECT whatsapp, name FROM users WHERE id = $1', [order.buyer_id]);
        const buyer = buyerResult.rows[0];
        if (buyer?.whatsapp) {
            const msg = order.delivery_method === 'delivery'
                ? `CampusCart: Order placed successfully! Your items will be delivered within 1-3 working days.`
                : `CampusCart: Order placed successfully! Arrange pickup with the seller on campus.`;
            sendOrderSMS(buyer.whatsapp, msg).catch((e) => console.error('SMS error:', e));
        }
    } catch (err) {
        console.error('Webhook processing error:', err);
    }
});

async function payoutSeller(sellerId, amountGHS, orderId) {
    const accResult = await pool.query('SELECT * FROM seller_payout_accounts WHERE seller_id = $1', [sellerId]);
    const account = accResult.rows[0];
    if (!account) {
        console.error(`Seller ${sellerId} has no payout account set up — cannot transfer`);
        return;
    }

    let recipientCode = account.paystack_recipient_code;
    if (!recipientCode) {
        const recipientRes = await createTransferRecipient({
            name: account.account_name,
            account_number: account.account_number,
            bank_code: account.bank_code,
        });
        recipientCode = recipientRes.data.recipient_code;
        await pool.query('UPDATE seller_payout_accounts SET paystack_recipient_code = $1 WHERE seller_id = $2', [recipientCode, sellerId]);
    }

    await initiateTransfer({
        recipient_code: recipientCode,
        amountGHS,
        reason: `CampusCart order ${orderId}`,
        reference: `payout_${orderId}_${sellerId}`,
    });
}

// GET /api/orders/:id — single order detail, for the post-payment confirmation page
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const orderResult = await pool.query(
            'SELECT * FROM orders WHERE id = $1 AND buyer_id = $2',
            [req.params.id, req.userId]
        );
        const order = orderResult.rows[0];
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const itemsResult = await pool.query(
            'SELECT id, title, quantity, price_at_purchase, seller_id FROM order_items WHERE order_id = $1',
            [order.id]
        );
        order.items = itemsResult.rows;

        res.json(order);
    } catch (err) {
        console.error('Get order error:', err);
        res.status(500).json({ error: 'Something went wrong fetching this order' });
    }
});

// GET /api/orders/mine?period=week|month|6months|year|all
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

// GET /api/orders/sales
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