const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction, verifyWebhookSignature } = require('../utils/paystack');
const { sendOrderSMS } = require('../utils/mailer');
const { calcDeliveryFee } = require('../utils/distance');

const router = express.Router();

const BUYER_FEE_RATE = 0.02;
const SELLER_FEE_RATE = 0.015;

// Helper: insert a notification
async function insertNotification(userId, type, message, relatedId = null, link = null) {
    await pool.query(
        `INSERT INTO notifications (user_id, type, message, related_id, link) VALUES ($1, $2, $3, $4, $5)`,
        [userId, type, message, relatedId, link]
    );
}

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
        const sellerSchools = {};

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

        let deliveryFee = 0;
        const deliveryFeeBySeller = {};
        if (delivery_method === 'delivery') {
            for (const [sellerId, school] of Object.entries(sellerSchools)) {
                const { fee } = calcDeliveryFee(buyer_lat, buyer_lng, school);
                deliveryFee += fee;
                deliveryFeeBySeller[sellerId] = fee;
            }
        }

        const creditedDeliveryFor = new Set();
        for (const item of lineItems) {
            const fee = deliveryFeeBySeller[item.seller_id];
            if (fee && !creditedDeliveryFor.has(item.seller_id)) {
                item.seller_earnings = Math.round((item.seller_earnings + fee) * 100) / 100;
                creditedDeliveryFor.add(item.seller_id);
            }
        }

        const buyerFee = Math.round(subtotal * BUYER_FEE_RATE * 100) / 100;
        const preCreditTotal = subtotal + deliveryFee + buyerFee;

        const buyerCreditResult = await client.query('SELECT credit_balance FROM users WHERE id = $1', [req.userId]);
        const availableCredit = parseFloat(buyerCreditResult.rows[0]?.credit_balance || 0);
        const creditApplied = Math.min(availableCredit, preCreditTotal);
        const totalAmount = Math.round((preCreditTotal - creditApplied) * 100) / 100;

        if (creditApplied > 0) {
            await client.query('UPDATE users SET credit_balance = credit_balance - $1 WHERE id = $2', [creditApplied, req.userId]);
        }

        const orderResult = await client.query(
            `INSERT INTO orders (buyer_id, status, delivery_method, subtotal, delivery_fee, total_amount, credit_applied)
             VALUES ($1, 'pending', $2, $3, $4, $5, $6)
             RETURNING id`,
            [req.userId, delivery_method || 'pickup', subtotal, deliveryFee, totalAmount, creditApplied]
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

        // Fully covered by credit — leave pending until buyer confirms.
        if (totalAmount <= 0) {
            for (const item of lineItems) {
                await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
            }
            await client.query('COMMIT');

            return res.status(201).json({
                id: orderId,
                subtotal,
                delivery_fee: deliveryFee,
                buyer_fee: buyerFee,
                total_amount: 0,
                credit_applied: creditApplied,
                fully_paid_by_credit: true,
            });
        }

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
    res.sendStatus(200);

    if (event.event !== 'charge.success') return;

    const reference = event.data.reference;

    try {
        const orderResult = await pool.query('SELECT * FROM orders WHERE payment_reference = $1', [reference]);
        const order = orderResult.rows[0];
        // Guard against Paystack's duplicate webhook retries — only process a 'pending' order once.
        if (!order || order.status !== 'pending') return;

        const itemsResult = await pool.query(
            'SELECT product_id, quantity, seller_id, title FROM order_items WHERE order_id = $1',
            [order.id]
        );

        for (const item of itemsResult.rows) {
            await pool.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
        }

        // Mark paid — order still isn't 'completed' until the buyer confirms receipt.
        await pool.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [order.id]);

        const buyerResult = await pool.query('SELECT name FROM users WHERE id = $1', [order.buyer_id]);
        const buyerName = buyerResult.rows[0]?.name || 'A buyer';

        const deliveryNote = order.delivery_method === 'delivery'
            ? 'Delivery within 1-3 working days.'
            : 'Buyer will arrange pickup with you on campus.';

        const sellerIds = [...new Set(itemsResult.rows.map((i) => i.seller_id))];

        for (const sellerId of sellerIds) {
            const itemNames = itemsResult.rows
                .filter((i) => i.seller_id === sellerId)
                .map((i) => i.title)
                .join(', ');

            const message = `CampusCart: ${buyerName} just paid for "${itemNames}". Delivery method: ${order.delivery_method}. ${deliveryNote}`;

            // Send notification to seller with link to their Delivery tab
            await insertNotification(sellerId, 'payment_received_seller', message, order.id, '/dashboard?tab=deliveries');

            // Optional SMS notifications can be re-enabled here but are currently set to skip to avoid crashes
        }
    } catch (err) {
        console.error('Webhook processing error:', err);
    }
});

// GET /api/orders/mine
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
                'SELECT id, title, quantity, price_at_purchase, seller_id, buyer_confirmed_at FROM order_items WHERE order_id = $1',
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
                SELECT oi.*, o.created_at AS order_created_at, o.status AS order_status, u.name AS buyer_name,
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
             ORDER BY order_created_at DESC`,
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

// GET /api/orders/deliveries — seller's pending deliveries: paid orders containing at least
// one of this seller's items, not yet marked completed by the buyer.
router.get('/deliveries', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                o.id AS order_id, o.status, o.delivery_method, o.created_at,
                o.delivered_at, o.delivered_by_seller_id,
                u.name AS buyer_name, u.location AS buyer_location, u.whatsapp AS buyer_whatsapp,
                COALESCE(
                    json_agg(json_build_object('title', oi.title, 'quantity', oi.quantity))
                    FILTER (WHERE oi.id IS NOT NULL),
                    '[]'
                ) AS items
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id AND oi.seller_id = $1
             JOIN users u ON u.id = o.buyer_id
             WHERE o.status = 'paid'
             GROUP BY o.id, u.name, u.location, u.whatsapp
             ORDER BY o.created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get deliveries error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your deliveries' });
    }
});

// GET /api/orders/:id
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

// POST /api/orders/:id/confirm-received
// DEPRECATED: Replaced by individual item confirm. Keeping for safe fallback.
router.post('/:id/confirm-received', requireAuth, async (req, res) => {
    return res.status(400).json({ error: 'Please confirm each item individually.' });
});

// POST /api/orders/:id/mark-delivered — seller confirms they've delivered the order.
router.post('/:id/mark-delivered', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const orderResult = await pool.query(`SELECT * FROM orders WHERE id = $1`, [id]);
        const order = orderResult.rows[0];
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const ownershipCheck = await pool.query(
            `SELECT 1 FROM order_items WHERE order_id = $1 AND seller_id = $2 LIMIT 1`,
            [id, req.userId]
        );
        if (ownershipCheck.rows.length === 0) {
            return res.status(403).json({ error: "You don't have any items in this order" });
        }

        if (order.status !== 'paid') {
            return res.status(400).json({ error: 'This order is not currently awaiting delivery' });
        }
        if (order.delivered_at) {
            return res.status(400).json({ error: 'This order has already been marked as delivered' });
        }

        const sellerResult = await pool.query('SELECT name FROM users WHERE id = $1', [req.userId]);
        const sellerName = sellerResult.rows[0]?.name || 'The seller';

        const buyerResult = await pool.query('SELECT location FROM users WHERE id = $1', [order.buyer_id]);
        const buyerLocation = buyerResult.rows[0]?.location || 'your specified location';

        await pool.query(
            `UPDATE orders SET delivered_at = now(), delivered_by_seller_id = $1, last_delivery_reminder_at = now() WHERE id = $2`,
            [req.userId, id]
        );

        const message = `${sellerName} has marked your order as delivered to ${buyerLocation}. Please go to your Orders tab to confirm you've received it.`;
        // Link buyer directly to their dashboard orders tab
        await insertNotification(order.buyer_id, 'order_delivered_buyer', message, order.id, '/dashboard?tab=orders');

        res.json({ success: true, message: 'Marked as delivered. The buyer has been notified.' });
    } catch (err) {
        console.error('Mark delivered error:', err);
        res.status(500).json({ error: 'Something went wrong marking this order as delivered' });
    }
});

// POST /api/order-items/:itemId/confirm
router.post('/order-items/:itemId/confirm', requireAuth, async (req, res) => {
    const { itemId } = req.params;

    try {
        // 1. Get the item and verify the buyer
        const itemResult = await pool.query(
            `SELECT oi.*, o.buyer_id 
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE oi.id = $1`,
            [itemId]
        );
        
        if (itemResult.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
        
        const item = itemResult.rows[0];
        
        // Check if the logged-in user is the buyer
        if (item.buyer_id !== req.userId) {
            return res.status(403).json({ error: 'You are not the buyer of this item' });
        }

        // 2. Mark this specific item as confirmed by the buyer
        await pool.query(
            `UPDATE order_items SET buyer_confirmed_at = now() WHERE id = $1`,
            [itemId]
        );

        // 3. Calculate exact splits:
        //    Buyer Fee = 2% of product price (Paid by buyer on top)
        //    Seller Fee = 1.5% of product price (Deducted from seller's earnings)
        const basePrice = parseFloat(item.price_at_purchase);
        const buyerFee = basePrice * 0.02;
        const sellerFee = basePrice * 0.015;
        const totalRevenue = basePrice + buyerFee; // Amount Paystack actually received
        
        // 4. Calculate Admin Net Profit:
        //    (Buyer Fee + Seller Fee) - (1.95% Paystack cut of total revenue)
        const grossAdminProfit = buyerFee + sellerFee;
        const paystackCut = totalRevenue * 0.0195;
        const adminNetProfit = Math.round((grossAdminProfit - paystackCut) * 100) / 100;

        // 5. Save the admin profit to the database
        await pool.query(
            `UPDATE order_items SET admin_net_profit = $1 WHERE id = $2`,
            [adminNetProfit, itemId]
        );

        // 6. Calculate seller's available earnings (98.5% of base price)
        const sellerEarnings = Math.round((basePrice - sellerFee) * 100) / 100;

        console.log(`[BUYER CONFIRMED] Item ${itemId}:`);
        console.log(`  - Base Price: GHS ${basePrice.toFixed(2)}`);
        console.log(`  - Buyer Fee (2%): GHS ${buyerFee.toFixed(2)}`);
        console.log(`  - Seller Fee (1.5%): GHS ${sellerFee.toFixed(2)}`);
        console.log(`  - Paystack Cut (1.95%): GHS ${paystackCut.toFixed(2)}`);
        console.log(`  - Admin Net Profit: GHS ${adminNetProfit.toFixed(2)}`);
        console.log(`  - Seller Available: GHS ${sellerEarnings.toFixed(2)}`);

        // 7. Notify seller their funds are available for withdrawal
        await insertNotification(
            item.seller_id,
            'funds_available',
            `A buyer confirmed receipt for "${item.title}". GHS ${sellerEarnings.toFixed(2)} is now available in your Payouts tab to withdraw.`,
            item.order_id,
            '/dashboard?tab=payouts'
        );

        res.json({ 
            success: true, 
            message: 'Item confirmed! Funds are now available for the seller to withdraw.' 
        });

    } catch (err) {
        console.error('Item confirm error:', err);
        res.status(500).json({ error: 'Failed to confirm item receipt' });
    }
});

module.exports = router;