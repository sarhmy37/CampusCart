const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction, verifyWebhookSignature, refundTransaction } = require('../utils/paystack');
const { sendOrderSMS } = require('../utils/mailer');
const { calcDeliveryFee } = require('../utils/distance');
const { getDeliveryDiscountRate } = require('../utils/plans');
const { getSellerFeeRate } = require('../utils/plans');

const router = express.Router();

router.get('/payment-redirect', (req, res) => {
  const status = req.query.status || 'done';
  res.send(`<html><body><script>window.location.href='app://payment/callback?status=${status}';</script></body></html>`);
});

const BUYER_FEE_RATE = 0.02;
const SELLER_FEE_RATE = 0.015;
const ADMIN_DELIVERY_SHARE = 0.20; // 20% of delivery fee goes to Admin
const SELLER_DELIVERY_SHARE = 0.80; // 80% of delivery fee goes to Seller
const PAYSTACK_MARKUP_RATE = 0.02; // flat 2% added at Paystack checkout (Paystack's real cut is 1.95%, the extra 0.05% stays with admin)

const { insertNotification } = require('../utils/notifications');

// Varied "funds available" messages so sellers don't see the same line every time.
const FUNDS_MESSAGES = [
    (amt, note, title) => `💰 Cha-ching! GHS ${amt}${note} just landed in your Payouts tab for "${title}".`,
    (amt, note, title) => `🎉 You got paid! GHS ${amt}${note} for "${title}" is now in your Payouts tab.`,
    (amt, note, title) => `✅ Sale confirmed! GHS ${amt}${note} for "${title}" is ready in your Payouts tab.`,
    (amt, note, title) => `🤑 Money moves! GHS ${amt}${note} from "${title}" is waiting in your Payouts tab.`,
    (amt, note, title) => `🚀 Nice one! GHS ${amt}${note} for "${title}" is now available to withdraw.`,
    (amt, note, title) => `💸 Fresh funds! GHS ${amt}${note} for "${title}" just hit your Payouts tab.`,
    (amt, note, title) => `🙌 Another win! GHS ${amt}${note} for "${title}" is yours to withdraw.`,
];
const pickFundsMessage = (amt, note, title) =>
    FUNDS_MESSAGES[Math.floor(Math.random() * FUNDS_MESSAGES.length)](amt, note, title);

// POST /api/orders — create pending order + get Paystack payment link
router.post('/', requireAuth, async (req, res) => {
    const { items, delivery_method, buyer_lat, buyer_lng } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
    }

    const verifyCheck = await pool.query('SELECT verified, plan, plan_expires_at FROM users WHERE id = $1', [req.userId]);
    if (!verifyCheck.rows[0]?.verified) {
        return res.status(403).json({ error: 'Please verify your email before placing an order', needs_verification: true });
    }
    const buyerPlan = verifyCheck.rows[0].plan;
    const buyerPlanExpiresAt = verifyCheck.rows[0].plan_expires_at;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let subtotal = 0;
        const lineItems = [];
        // Stores { school, delivery_fee_on_campus, delivery_fee_near_campus, delivery_fee_far_campus }
        // per seller, taking the MAX of each tier across that seller's items in the cart.
        const sellerDeliveryInfo = {};

        for (const { product_id, quantity } of items) {
            const qty = Number(quantity) || 1;

            const productResult = await client.query(
                `SELECT p.id, p.title, p.price, p.stock, p.seller_id, u.school, u.plan, u.plan_expires_at,
                        p.delivery_fee_on_campus, p.delivery_fee_near_campus, p.delivery_fee_far_campus
                 FROM products p JOIN users u ON u.id = p.seller_id
                 WHERE p.id = $1 FOR UPDATE OF p`,
                [product_id]
            );
            const product = productResult.rows[0];
            if (!product) throw { status: 404, message: 'A product in your cart no longer exists' };
            if (String(product.seller_id) === String(req.userId)) throw { status: 400, message: 'You cannot buy your own listing' };
            if (product.stock < qty) throw { status: 400, message: `Not enough stock for "${product.title}"` };

            if (!sellerDeliveryInfo[product.seller_id]) {
                sellerDeliveryInfo[product.seller_id] = {
                    school: product.school,
                    delivery_fee_on_campus: product.delivery_fee_on_campus || 0,
                    delivery_fee_near_campus: product.delivery_fee_near_campus || 0,
                    delivery_fee_far_campus: product.delivery_fee_far_campus || 0,
                };
            } else {
                // Same seller, different item — use the higher of the two set fees per tier
                const existing = sellerDeliveryInfo[product.seller_id];
                existing.delivery_fee_on_campus = Math.max(existing.delivery_fee_on_campus, product.delivery_fee_on_campus || 0);
                existing.delivery_fee_near_campus = Math.max(existing.delivery_fee_near_campus, product.delivery_fee_near_campus || 0);
                existing.delivery_fee_far_campus = Math.max(existing.delivery_fee_far_campus, product.delivery_fee_far_campus || 0);
            }

            const lineTotal = parseFloat(product.price) * qty;
            const sellerFeeRate = getSellerFeeRate(product.plan, product.plan_expires_at);
            const sellerFee = Math.round(lineTotal * sellerFeeRate * 100) / 100;
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

        // ============ ONE DELIVERY FEE PER SELLER (not per item) ============
        // deliveryFeeBySeller stays FULL/undiscounted — seller earnings below are
        // calculated off this, so a buyer's plan discount never reduces what the
        // seller receives. Only the buyer-facing total (deliveryFee) is discounted.
        let deliveryFeeFull = 0;
        const deliveryFeeBySeller = {};
        if (delivery_method === 'delivery') {
            for (const [sellerId, info] of Object.entries(sellerDeliveryInfo)) {
                const { fee } = calcDeliveryFee(buyer_lat, buyer_lng, info.school, info);
                deliveryFeeFull += fee;
                deliveryFeeBySeller[sellerId] = fee;
            }
        }

        const deliveryDiscountRate = getDeliveryDiscountRate(buyerPlan, buyerPlanExpiresAt);
        // Discount applies to the FULL delivery fee the buyer sees. The seller's 80%
        // share is still always fixed off the FULL, undiscounted per-seller fee (below) —
        // so the entire cost of the discount is absorbed out of the admin's cut.
        const deliveryFee = Math.round((deliveryFeeFull - deliveryFeeFull * deliveryDiscountRate) * 100) / 100;

        // ============ 80/20 DELIVERY SPLIT LOGIC (per seller, credited once) ============
        const creditedDeliveryFor = new Set();
        for (const item of lineItems) {
            const totalDeliveryFee = deliveryFeeBySeller[item.seller_id];
            if (totalDeliveryFee && !creditedDeliveryFor.has(item.seller_id)) {
                const sellerDeliveryShare = Math.round(totalDeliveryFee * SELLER_DELIVERY_SHARE * 100) / 100;
                const adminDeliveryShare = Math.round((totalDeliveryFee * (ADMIN_DELIVERY_SHARE - deliveryDiscountRate)) * 100) / 100;
                item.seller_earnings = Math.round((item.seller_earnings + sellerDeliveryShare) * 100) / 100;
                item.admin_delivery_share = adminDeliveryShare;
                item.delivery_fee_credited = sellerDeliveryShare; // for the seller-facing notification text
                creditedDeliveryFor.add(item.seller_id);
            }
        }
        // ====================================================

        // Buyer-facing total shown/confirmed in-app is just subtotal + delivery —
        // the 2% processing fee is applied once, only at the Paystack checkout step
        // below (paystackAmount), so it's never double-counted.
        const preCreditTotal = subtotal + deliveryFee;

        const buyerCreditResult = await client.query('SELECT credit_balance FROM users WHERE id = $1', [req.userId]);
        const availableCredit = parseFloat(buyerCreditResult.rows[0]?.credit_balance || 0);
        const creditApplied = Math.min(availableCredit, preCreditTotal);
        const totalAmount = Math.round((preCreditTotal - creditApplied) * 100) / 100;

        if (creditApplied > 0) {
            await client.query('UPDATE users SET credit_balance = credit_balance - $1 WHERE id = $2', [creditApplied, req.userId]);
        }

        const existingCartOrder = await client.query(
            `SELECT id FROM orders WHERE buyer_id = $1 AND status = 'pending' AND payment_reference IS NULL FOR UPDATE`,
            [req.userId]
        );

        let orderId;
        if (existingCartOrder.rows.length > 0) {
            orderId = existingCartOrder.rows[0].id;
            await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
            await client.query(
                `UPDATE orders SET delivery_method = $1, subtotal = $2, delivery_fee = $3, delivery_fee_full = $4, total_amount = $5, credit_applied = $6 WHERE id = $7`,
                [delivery_method || 'pickup', subtotal, deliveryFee, deliveryFeeFull, totalAmount, creditApplied, orderId]
            );
        } else {
            const orderResult = await client.query(
                `INSERT INTO orders (buyer_id, status, delivery_method, subtotal, delivery_fee, delivery_fee_full, total_amount, credit_applied)
                 VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7)
                 RETURNING id`,
                [req.userId, delivery_method || 'pickup', subtotal, deliveryFee, deliveryFeeFull, totalAmount, creditApplied]
            );
            orderId = orderResult.rows[0].id;
        }

        for (const item of lineItems) {
            await client.query(
                `INSERT INTO order_items
                    (order_id, product_id, seller_id, title, quantity, price_at_purchase, platform_fee, seller_earnings, admin_delivery_share, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
                [orderId, item.product_id, item.seller_id, item.title, item.quantity, item.price_at_purchase, item.platform_fee, item.seller_earnings, item.admin_delivery_share || 0]
            );
        }

        const userResult = await client.query('SELECT university_email, personal_email FROM users WHERE id = $1', [req.userId]);
        const buyerEmail = userResult.rows[0]?.personal_email || userResult.rows[0]?.university_email;

        const reference = `cc_${orderId}`;
        await client.query('UPDATE orders SET payment_reference = $1 WHERE id = $2', [reference, orderId]);

        // Fully covered by credit — no Paystack charge. Mark paid straight away and notify the sellers.
        if (totalAmount <= 0) {
            for (const item of lineItems) {
                await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
            }
            await client.query(`UPDATE orders SET status = 'paid', paystack_amount = 0 WHERE id = $1`, [orderId]);
            await client.query('COMMIT');

            try {
                // Buyer: payment successful
                await insertNotification(
                    req.userId,
                    'payment_success_buyer',
                    `Your payment for Order #${orderId} was successful. The seller(s) have been notified.`,
                    orderId,
                    '/dashboard?tab=orders'
                );

                // Sellers: new order
                const buyerRow = (await pool.query('SELECT name, location FROM users WHERE id = $1', [req.userId])).rows[0];
                const deliveryNote = delivery_method === 'delivery'
                    ? 'get it delivered within 1–3 working days to secure the sale.'
                    : "they'll reach out to arrange pickup on campus.";
                const locationPhrase = buyerRow?.location ? `This person is located at ${buyerRow.location}, ` : '';
                for (const sellerId of [...new Set(lineItems.map((i) => i.seller_id))]) {
                    const mine = lineItems.filter((i) => i.seller_id === sellerId);
                    const names = mine.map((i) => i.title).join(', ');
                    const amount = mine.reduce((s, i) => s + parseFloat(i.price_at_purchase) * i.quantity, 0);
                    await insertNotification(
                        sellerId,
                        'payment_received_seller',
                        `🎉 ${buyerRow?.name || 'A buyer'} just bought ${names} for GHS ${amount.toFixed(2)}. ${locationPhrase}${deliveryNote}`,
                        orderId,
                        '/dashboard?tab=deliveries'
                    );
                }
            } catch (notifyErr) {
                console.error('Credit order notify error:', notifyErr);
            }

            return res.status(201).json({
                id: orderId,
                subtotal,
                delivery_fee: deliveryFee,
                total_amount: 0,
                credit_applied: creditApplied,
                fully_paid_by_credit: true,
            });
        }

        // 👇 The amount actually charged on Paystack includes a flat 2% markup on top of
        // totalAmount. Paystack's real cut is 1.95%, so the extra 0.05% stays with admin.
        // The buyer only ever sees `totalAmount` on our own site — this markup only shows
        // up on Paystack's own checkout page.
        const paystackAmount = Math.round(totalAmount * (1 + PAYSTACK_MARKUP_RATE) * 100) / 100;
        await client.query('UPDATE orders SET paystack_amount = $1 WHERE id = $2', [paystackAmount, orderId]);

        await client.query('COMMIT');

        const paystackRes = await initializeTransaction({
            email: buyerEmail,
            amountGHS: paystackAmount,
            reference,
            callback_url: 'https://campuscart-tdfn.onrender.com/paystack/callback',
            cancel_action: 'https://campuscart-tdfn.onrender.com/paystack/callback?status=cancel',
            metadata: { order_id: orderId, buyer_id: req.userId },
        });

        res.status(201).json({
            id: orderId,
            subtotal,
            delivery_fee: deliveryFee,
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

    // Subscription payments use a 'sub_' prefixed reference — hand those off
    // to the subscriptions module instead of processing them as an order.
    if (reference.startsWith('sub_')) {
        const { processSubscriptionWebhookEvent } = require('./subscriptions');
        try {
            await processSubscriptionWebhookEvent(event);
        } catch (err) {
            console.error('Subscription webhook processing error:', err);
        }
        return;
    }

    // Booking payments use a 'book_' prefixed reference
    if (reference.startsWith('book_')) {
        const { processBookingWebhookEvent } = require('./bookings');
        try {
            await processBookingWebhookEvent(event);
        } catch (err) {
            console.error('Booking webhook processing error:', err);
        }
        return;
    }

    // Boost payments use a 'boost_' prefixed reference
    if (reference.startsWith('boost_')) {
        const { processBoostWebhookEvent } = require('./boosts');
        try {
            await processBoostWebhookEvent(event);
        } catch (err) {
            console.error('Boost webhook processing error:', err);
        }
        return;
    }

    try {
        const orderResult = await pool.query('SELECT * FROM orders WHERE payment_reference = $1', [reference]);
        const order = orderResult.rows[0];
        // Guard against Paystack's duplicate webhook retries — only process a 'pending' order once.
        if (!order || order.status !== 'pending') return;

        // 👇 Amount check: Paystack sends the amount actually charged, in kobo/pesewas (subunit).
        // Compare it against the paystack_amount we stored when the order was created, so a
        // mismatch (fee changes, tampering, a stale/replayed reference) gets flagged instead of
        // silently marking the order paid.
        const amountPaidGHS = Math.round((event.data.amount / 100) * 100) / 100;
        const expectedGHS = parseFloat(order.paystack_amount);

        if (Math.abs(amountPaidGHS - expectedGHS) > 0.05) {
            console.error(
                `[WEBHOOK AMOUNT MISMATCH] Order ${order.id}: expected GHS ${expectedGHS}, Paystack reported GHS ${amountPaidGHS}. Not marking as paid.`
            );
            await insertNotification(
                order.buyer_id,
                'payment_flagged',
                `We noticed something off with your payment for Order #${order.id}. Our team's already looking into it — we'll update you shortly.`,
                order.id,
                `/dashboard?tab=orders`
            );
            return;
        }

        const itemsResult = await pool.query(
            'SELECT product_id, quantity, seller_id, title FROM order_items WHERE order_id = $1',
            [order.id]
        );

        for (const item of itemsResult.rows) {
            await pool.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
        }

        // Mark paid — order still isn't 'completed' until the buyer confirms receipt.
        await pool.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [order.id]);

        // Buyer: payment successful
        await insertNotification(
            order.buyer_id,
            'payment_success_buyer',
            `Your payment for Order #${order.id} was successful. The seller(s) have been notified.`,
            order.id,
            '/dashboard?tab=orders'
        );

        const buyerResult = await pool.query('SELECT name, location FROM users WHERE id = $1', [order.buyer_id]);
        const buyerName = buyerResult.rows[0]?.name || 'A buyer';
        const buyerLocation = buyerResult.rows[0]?.location;

        const deliveryNote = order.delivery_method === 'delivery'
            ? "get it delivered within 1–3 working days to secure the sale."
            : "they'll reach out to arrange pickup on campus.";

        const locationPhrase = buyerLocation
            ? `This person is located at ${buyerLocation}, `
            : '';

        // Need each item's quantity + price so we can total up what THIS seller
        // is owed from this order, not the order's grand total (which may span
        // multiple sellers).
        const itemsWithPricing = await pool.query(
            'SELECT seller_id, title, quantity, price_at_purchase FROM order_items WHERE order_id = $1',
            [order.id]
        );

        const sellerIds = [...new Set(itemsResult.rows.map((i) => i.seller_id))];

        for (const sellerId of sellerIds) {
            const sellerItems = itemsWithPricing.rows.filter((i) => i.seller_id === sellerId);
            const itemNames = sellerItems.map((i) => i.title).join(', ');
            const sellerAmount = sellerItems.reduce(
                (sum, i) => sum + parseFloat(i.price_at_purchase) * i.quantity,
                0
            );

            const message = `🎉 ${buyerName} just bought ${itemNames} for GHS ${sellerAmount.toFixed(2)}. ${locationPhrase}${deliveryNote}`;

            // Sellers: new order, with link to their Delivery tab
            await insertNotification(sellerId, 'payment_received_seller', message, order.id, '/dashboard?tab=deliveries');
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

        const meResult = await pool.query(
            `SELECT name, CASE WHEN plan_expires_at > NOW() THEN plan ELSE 'free' END AS plan FROM users WHERE id = $1`,
            [req.userId]
        );
        const me = meResult.rows[0] || {};

        for (const order of orders) {
            order.buyer_name = me.name;
            order.buyer_plan = me.plan;
            const itemsResult = await pool.query(
                `SELECT oi.id, oi.product_id, oi.title, oi.quantity, oi.price_at_purchase, oi.seller_id, oi.buyer_confirmed_at, oi.status, oi.delivered_at,
                        p.primary_image AS image, u.name AS seller_name,
                        CASE WHEN u.plan_expires_at > NOW() THEN u.plan ELSE 'free' END AS seller_plan
                 FROM order_items oi
                 LEFT JOIN products p ON p.id = oi.product_id
                 LEFT JOIN users u ON u.id = oi.seller_id
                 WHERE oi.order_id = $1`,
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

// GET /api/orders/sales — only shows sales the buyer has actually confirmed as received
router.get('/sales', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `WITH numbered AS (
                SELECT oi.*, o.created_at AS order_created_at, o.status AS order_status, u.name AS buyer_name,
                       CASE WHEN oi.buyer_confirmed_at IS NOT NULL
                            THEN ROW_NUMBER() OVER (
                                PARTITION BY oi.seller_id, (oi.buyer_confirmed_at IS NOT NULL)
                                ORDER BY o.created_at ASC
                            )
                       END AS completed_rank
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                JOIN users u ON u.id = o.buyer_id
                WHERE oi.seller_id = $1 AND (oi.buyer_confirmed_at IS NOT NULL OR oi.status = 'cancelled')
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
                MAX(oi.delivered_at) AS delivered_at, o.delivered_by_seller_id,
                o.buyer_id, u.name AS buyer_name, u.location AS buyer_location, u.whatsapp AS buyer_whatsapp,
                COALESCE(
                    json_agg(json_build_object('title', oi.title, 'quantity', oi.quantity, 'image', p.primary_image))
                    FILTER (WHERE oi.id IS NOT NULL),
                    '[]'
                ) AS items
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id AND oi.seller_id = $1 AND oi.status <> 'cancelled'
             JOIN users u ON u.id = o.buyer_id
             LEFT JOIN products p ON p.id = oi.product_id
             WHERE o.status = 'paid'
             GROUP BY o.id, u.name, u.location, u.whatsapp
             HAVING COUNT(*) FILTER (WHERE oi.buyer_confirmed_at IS NULL) > 0
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
            'SELECT id, product_id, title, quantity, price_at_purchase, seller_id FROM order_items WHERE order_id = $1',
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
            `SELECT 1 FROM order_items WHERE order_id = $1 AND seller_id = $2 AND status <> 'cancelled' LIMIT 1`,
            [id, req.userId]
        );
        if (ownershipCheck.rows.length === 0) {
            return res.status(403).json({ error: "You don't have any items in this order" });
        }

        if (order.status !== 'paid') {
            return res.status(400).json({ error: 'This order is not currently awaiting delivery' });
        }
        const myUndelivered = await pool.query(
            `SELECT 1 FROM order_items WHERE order_id = $1 AND seller_id = $2 AND status <> 'cancelled' AND delivered_at IS NULL LIMIT 1`,
            [id, req.userId]
        );
        if (myUndelivered.rows.length === 0) {
            return res.status(400).json({ error: 'You have already marked your items as delivered' });
        }

        const sellerResult = await pool.query('SELECT name FROM users WHERE id = $1', [req.userId]);
        const sellerName = sellerResult.rows[0]?.name || 'The seller';

        const buyerResult = await pool.query('SELECT location, sms_number FROM users WHERE id = $1', [order.buyer_id]);
        const buyerLocation = buyerResult.rows[0]?.location || 'your specified location';
        const buyerSmsNumber = buyerResult.rows[0]?.sms_number;

        await pool.query(
            `UPDATE order_items SET delivered_at = now()
             WHERE order_id = $1 AND seller_id = $2 AND status <> 'cancelled' AND delivered_at IS NULL`,
            [id, req.userId]
        );
        await pool.query(
            `UPDATE orders SET delivered_at = COALESCE(delivered_at, now()),
                    delivered_by_seller_id = COALESCE(delivered_by_seller_id, $1),
                    last_delivery_reminder_at = now()
             WHERE id = $2`,
            [req.userId, id]
        );

        const message = `📦 ${sellerName} says your order is on its way to ${buyerLocation}. Confirm once it arrives so they can get paid.`;
        await insertNotification(order.buyer_id, 'order_delivered_buyer', message, order.id, '/dashboard?tab=orders');

        if (buyerSmsNumber) {
            sendOrderSMS(buyerSmsNumber, `Tre-X: Your order has been marked as delivered to ${buyerLocation}. Open the app to confirm you've received it.`)
                .catch((err) => console.error('Delivery SMS failed:', err));
        }

        res.json({ success: true, message: 'Marked as delivered. The buyer has been notified.' });
    } catch (err) {
        console.error('Mark delivered error:', err);
        res.status(500).json({ error: 'Something went wrong marking this order as delivered' });
    }
});

// POST /api/orders/:id/cancel — a seller cancels THEIR items in an order before delivery.
// The buyer is refunded that seller's share (items + delivery); other sellers' items carry on.
router.post('/:id/cancel', requireAuth, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    const fail = async (status, error) => {
        await client.query('ROLLBACK');
        return res.status(status).json({ error });
    };
    const round2 = (n) => Math.round(n * 100) / 100;

    try {
        await client.query('BEGIN');

        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        const order = orderResult.rows[0];
        if (!order) return fail(404, 'Order not found');
        if (order.status !== 'paid') return fail(400, 'Only paid orders can be cancelled');

        const itemsResult = await client.query(
            `SELECT id, title, product_id, quantity, seller_id, price_at_purchase, platform_fee,
                    seller_earnings, admin_delivery_share, buyer_confirmed_at, delivered_at, status
             FROM order_items WHERE order_id = $1`,
            [id]
        );
        const activeItems = itemsResult.rows.filter((i) => i.status !== 'cancelled');
        const myItems = activeItems.filter((i) => i.seller_id === req.userId);
        if (myItems.length === 0) return fail(403, "You don't have any active items in this order");
        if (myItems.some((i) => i.buyer_confirmed_at || i.delivered_at)) return fail(400, 'You already marked these items as delivered, so they can no longer be cancelled');

        // What the buyer paid for this seller's items: goods + this seller's delivery share
        // (seller's 80% + the admin share stored per item), before credit and Paystack markup.
        const valueOf = (i) => {
            const goods = parseFloat(i.price_at_purchase) * i.quantity;
            const sellerDelivery = i.seller_earnings == null
                ? 0
                : parseFloat(i.seller_earnings) - (goods - parseFloat(i.platform_fee || 0));
            return goods + sellerDelivery + parseFloat(i.admin_delivery_share || 0);
        };
        const myValue = myItems.reduce((s, i) => s + valueOf(i), 0);
        const orderValue = parseFloat(order.subtotal) + parseFloat(order.delivery_fee || 0);

        const isLastSeller = activeItems.every((i) => i.seller_id === req.userId);
        const share = orderValue > 0 ? Math.min(1, myValue / orderValue) : 1;

        // Refund is based on total_amount (what the order cost), not paystack_amount (which includes the non-refundable 2%).
        const paystackTotal = parseFloat(order.total_amount || 0);
        const creditTotal = parseFloat(order.credit_applied || 0);
        // Last seller gets the exact remainder so rounding never leaves pesewas behind.
        const refundPaystack = isLastSeller
            ? round2(paystackTotal - parseFloat(order.paystack_refunded || 0))
            : round2(paystackTotal * share);
        const refundCredit = isLastSeller
            ? round2(creditTotal - parseFloat(order.credit_refunded || 0))
            : round2(creditTotal * share);

        for (const i of myItems) {
            await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [i.quantity, i.product_id]);
        }
        if (refundCredit > 0) {
            await client.query('UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2', [refundCredit, order.buyer_id]);
        }

        await client.query(
            `UPDATE order_items SET status = 'cancelled', cancelled_at = now()
             WHERE order_id = $1 AND seller_id = $2 AND status <> 'cancelled'`,
            [id, req.userId]
        );

        const remaining = await client.query(
            `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE buyer_confirmed_at IS NULL) AS unconfirmed
             FROM order_items WHERE order_id = $1 AND status <> 'cancelled'`,
            [id]
        );
        const total = parseInt(remaining.rows[0].total, 10);
        const unconfirmed = parseInt(remaining.rows[0].unconfirmed, 10);
        let newStatus = 'paid';
        if (total === 0) newStatus = 'cancelled';
        else if (unconfirmed === 0) newStatus = 'completed';

        await client.query(
            `UPDATE orders SET status = $1,
                    paystack_refunded = COALESCE(paystack_refunded, 0) + $2,
                    credit_refunded = COALESCE(credit_refunded, 0) + $3
             WHERE id = $4`,
            [newStatus, refundPaystack, refundCredit, id]
        );
        if (newStatus === 'cancelled') {
            await client.query(
                `UPDATE orders SET cancelled_at = now(), cancelled_by_seller_id = $1 WHERE id = $2`,
                [req.userId, id]
            );
        }

        // Refund last: if Paystack rejects it, everything above rolls back.
        if (refundPaystack > 0) await refundTransaction(order.payment_reference, refundPaystack);

        await client.query('COMMIT');

        const refundTotal = round2(refundPaystack + refundCredit);
        res.json({ success: true, order_status: newStatus, refunded: refundTotal });

        try {
        const titles = myItems.map((i) => i.title).join(', ');
        const sellerName = (await pool.query('SELECT name FROM users WHERE id = $1', [req.userId])).rows[0]?.name || 'The seller';
        const buyerSmsNumber = (await pool.query('SELECT sms_number FROM users WHERE id = $1', [order.buyer_id])).rows[0]?.sms_number;

        await insertNotification(
            order.buyer_id,
            'order_cancelled_buyer',
           `❌ ${sellerName} cancelled ${titles}. Your refund of GHS ${refundTotal.toFixed(2)} is on its way and should reach you within 30 minutes. The 2% processing fee is non-refundable.`,
            order.id,
            '/dashboard?tab=orders'
        );
        await insertNotification(
            req.userId,
            'order_cancelled_seller',
            `You cancelled ${titles} in Order #${order.id}. The buyer has been refunded.`,
            order.id,
            '/dashboard?tab=deliveries'
        );
        if (buyerSmsNumber) {
           sendOrderSMS(buyerSmsNumber, `Tre-X: ${titles} was cancelled by the seller. Your refund of GHS ${refundTotal.toFixed(2)} should reach you within 30 minutes.`)
                .catch((err) => console.error('Cancel SMS failed:', err));
        }

        } catch (notifyErr) {
            console.error('Cancel notifications failed:', notifyErr);
        }
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Cancel order error:', err);
        res.status(500).json({ error: 'Could not cancel this order. Nothing was changed, please try again.' });
    } finally {
        client.release();
    }
});

// POST /api/orders/order-items/:itemId/confirm
router.post('/order-items/:itemId/confirm', requireAuth, async (req, res) => {
    const { itemId } = req.params;

    try {
        const itemResult = await pool.query(
            `SELECT oi.*, o.buyer_id, o.status AS order_status, u.plan AS seller_plan, u.plan_expires_at AS seller_plan_expires_at
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN users u ON u.id = oi.seller_id
             WHERE oi.id = $1`,
            [itemId]
        );

        if (itemResult.rows.length === 0) return res.status(404).json({ error: 'Item not found' });

        const item = itemResult.rows[0];

        if (item.buyer_id !== req.userId) {
            return res.status(403).json({ error: 'You are not the buyer of this item' });
        }
        if (item.order_status !== 'paid') {
            return res.status(400).json({ error: 'This order is not awaiting confirmation' });
        }
        if (item.status === 'cancelled') {
            return res.status(400).json({ error: 'This item was cancelled' });
        }
        if (item.buyer_confirmed_at) {
            return res.status(400).json({ error: 'You already confirmed this item' });
        }

        const sellerSmsResult = await pool.query('SELECT sms_number FROM users WHERE id = $1', [item.seller_id]);
        const sellerSmsNumber = sellerSmsResult.rows[0]?.sms_number;

        await pool.query(
            `UPDATE order_items SET buyer_confirmed_at = now(), status = 'completed' WHERE id = $1`,
            [itemId]
        );

        // If every item in this order is now confirmed, mark the whole order completed
        const remainingResult = await pool.query(
            `SELECT COUNT(*) FROM order_items WHERE order_id = $1 AND buyer_confirmed_at IS NULL AND status <> 'cancelled'`,
            [item.order_id]
        );
        const orderNowCompleted = parseInt(remainingResult.rows[0].count, 10) === 0;
        if (orderNowCompleted) {
            await pool.query(`UPDATE orders SET status = 'completed' WHERE id = $1`, [item.order_id]);
        }

        // ============ ADMIN NET PROFIT CALCULATION ============
        // 1. Base product price
        const basePrice = parseFloat(item.price_at_purchase) * item.quantity;

        // 2. Buyer 2% fee
        const buyerFee = basePrice * 0.02;

        // 3. Seller fee — 0% on an active paid plan, 1.5% on Free
        const sellerFeeRate = getSellerFeeRate(item.seller_plan, item.seller_plan_expires_at);
        const sellerFee = basePrice * sellerFeeRate;

        // 4. Admin's 20% delivery share — stored per-item at order creation
        // (already correctly computed per seller, once). Older items without
        // it just get 0 rather than a wrong recalculated number.
        const adminDeliveryShare = parseFloat(item.admin_delivery_share || 0);

        // 5. Gross admin profit = buyer fee + seller fee + admin's delivery share.
        //    Paystack's cut is NO LONGER subtracted here — it's now covered upfront by the
        //    2% markup added to the buyer's Paystack payment (see paystackAmount in POST /).
        //    The extra 0.05% (2% markup vs Paystack's real 1.95% cut) stays with admin as a buffer.
        const grossAdminProfit = buyerFee + sellerFee + adminDeliveryShare;
        const adminNetProfit = Math.round(grossAdminProfit * 100) / 100;

        // 6. Save to database
        await pool.query(
            `UPDATE order_items SET admin_net_profit = $1 WHERE id = $2`,
            [adminNetProfit, itemId]
        );

        // 7. Use the earnings already computed and stored at order creation —
        // delivery share was only credited to ONE item per seller per order there,
        // so recalculating it here for every item would double-count it.
        const sellerEarnings = parseFloat(item.seller_earnings);

        console.log(`[BUYER CONFIRMED] Item ${itemId}:`);
        console.log(`  - Product Price: GHS ${basePrice.toFixed(2)}`);
        console.log(`  - Buyer Fee (2%): GHS ${buyerFee.toFixed(2)}`);
        console.log(`  - Seller Fee (1.5%): GHS ${sellerFee.toFixed(2)}`);
        console.log(`  - Admin Delivery Share (20%): GHS ${adminDeliveryShare.toFixed(2)}`);
        console.log(`  - Admin Net Profit: GHS ${adminNetProfit.toFixed(2)}`);
        console.log(`  - Seller Available: GHS ${sellerEarnings.toFixed(2)}`);
        // ======================================================

        // Seller: funds available (fires for every confirmed item)
        const deliveryNote = item.delivery_fee_credited
            ? ` (includes GHS ${parseFloat(item.delivery_fee_credited).toFixed(2)} delivery fee)`
            : '';
        const sendFundsNotification = () =>
            insertNotification(
                item.seller_id,
                'funds_available',
                pickFundsMessage(sellerEarnings.toFixed(2), deliveryNote, item.title),
                item.order_id,
                '/dashboard?tab=payouts'
            ).catch((err) => console.error('Funds notification failed:', err));

        if (orderNowCompleted) {
            // Let "Order completed" land first, then the funds notification a minute later.
            setTimeout(sendFundsNotification, 60 * 1000);
        } else {
            await sendFundsNotification();
        }
        if (sellerSmsNumber) {
            sendOrderSMS(sellerSmsNumber, `Tre-X: Buyer confirmed receipt of "${item.title}". GHS ${sellerEarnings.toFixed(2)} is now available in your Payouts tab.`)
                .catch((err) => console.error('Delivery confirm SMS failed:', err));
        }

        // Order completed: buyer + sellers (fires once, when the last item is confirmed)
        if (orderNowCompleted) {
            try {
                await insertNotification(
                    req.userId,
                    'order_completed_buyer',
                    `Order #${item.order_id} is complete. Thanks for confirming! Tap to rate your purchase.`,
                    item.order_id,
                    '/dashboard?tab=orders'
                );

                const completedSellers = await pool.query(
                    `SELECT DISTINCT seller_id FROM order_items WHERE order_id = $1 AND status <> 'cancelled'`,
                    [item.order_id]
                );
                for (const { seller_id } of completedSellers.rows) {
                    await insertNotification(
                        seller_id,
                        'order_completed_seller',
                        `✅ Order #${item.order_id} is complete. The buyer has confirmed everything.`,
                        item.order_id,
                        '/dashboard?tab=payouts'
                    );
                }
            } catch (notifyErr) {
                console.error('Order completed notifications failed:', notifyErr);
            }
        }

        res.json({
            success: true,
            message: 'Item confirmed! Funds are now available for the seller to withdraw.'
        });

    } catch (err) {
        console.error('Item confirm error:', err);
        res.status(500).json({ error: 'Failed to confirm item receipt' });
    }
});

// POST /api/orders/cart-sync — mirrors the buyer's current cart into a 'pending'
// order so it shows up in their Orders tab immediately, before checkout.
router.post('/cart-sync', requireAuth, async (req, res) => {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        await pool.query(
            `DELETE FROM orders WHERE buyer_id = $1 AND status = 'pending' AND payment_reference IS NULL`,
            [req.userId]
        );
        return res.json({ synced: true, cleared: true });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let subtotal = 0;
        const lineItems = [];
        for (const { product_id, quantity } of items) {
            const qty = Number(quantity) || 1;
            const productResult = await client.query(
                'SELECT id, title, price, seller_id FROM products WHERE id = $1',
                [product_id]
            );
            const product = productResult.rows[0];
            if (!product) continue;
            subtotal += parseFloat(product.price) * qty;
            lineItems.push({
                product_id: product.id,
                seller_id: product.seller_id,
                title: product.title,
                quantity: qty,
                price_at_purchase: product.price,
            });
        }

        const existing = await client.query(
            `SELECT id FROM orders WHERE buyer_id = $1 AND status = 'pending' AND payment_reference IS NULL FOR UPDATE`,
            [req.userId]
        );

        let orderId;
        if (existing.rows.length > 0) {
            orderId = existing.rows[0].id;
            await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
            await client.query('UPDATE orders SET subtotal = $1, total_amount = $1 WHERE id = $2', [subtotal, orderId]);
        } else {
            const orderResult = await client.query(
                `INSERT INTO orders (buyer_id, status, delivery_method, subtotal, total_amount)
                 VALUES ($1, 'pending', 'pickup', $2, $2)
                 RETURNING id`,
                [req.userId, subtotal]
            );
            orderId = orderResult.rows[0].id;
        }

        for (const item of lineItems) {
            await client.query(
                `INSERT INTO order_items (order_id, product_id, seller_id, title, quantity, price_at_purchase, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
                [orderId, item.product_id, item.seller_id, item.title, item.quantity, item.price_at_purchase]
            );
        }

        await client.query('COMMIT');
        res.json({ synced: true, order_id: orderId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Cart sync error:', err);
        res.status(500).json({ error: 'Failed to sync cart' });
    } finally {
        client.release();
    }
});

// DELETE /api/orders/cart-sync — clears the pending cart-order (e.g. buyer emptied their cart)
router.delete('/cart-sync', requireAuth, async (req, res) => {
    try {
        await pool.query(
            `DELETE FROM orders WHERE buyer_id = $1 AND status = 'pending' AND payment_reference IS NULL`,
            [req.userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Cart clear error:', err);
        res.status(500).json({ error: 'Failed to clear cart order' });
    }
});

// POST /api/orders/:id/report — buyer says a delivered order hasn't arrived. Admin reviews it by hand.
router.post('/:id/report', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE orders SET reported_at = now()
             WHERE id = $1 AND buyer_id = $2 AND status = 'paid'
               AND delivered_at IS NOT NULL AND reported_at IS NULL
             RETURNING id`,
            [req.params.id, req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'This order cannot be reported right now' });
        }
        const orderId = result.rows[0].id;

        await insertNotification(
            req.userId,
            'order_reported_buyer',
            `Your report on Order #${orderId} was received. We'll review it and contact you.`,
            orderId,
            '/dashboard?tab=orders'
        );

        const sellers = await pool.query(
            `SELECT DISTINCT seller_id FROM order_items WHERE order_id = $1 AND status <> 'cancelled'`,
            [orderId]
        );
        for (const { seller_id } of sellers.rows) {
            await insertNotification(
                seller_id,
                'order_reported_seller',
                `The buyer reported a problem with Order #${orderId}. Our team is reviewing it.`,
                orderId,
                '/dashboard?tab=deliveries'
            );
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Report order error:', err);
        res.status(500).json({ error: 'Could not send your report. Please try again.' });
    }
});

// POST /api/orders/run-delivery-reminders — called by an external cron every ~10 minutes.
router.post('/run-delivery-reminders', async (req, res) => {
    if (!process.env.CRON_KEY || req.headers['x-cron-key'] !== process.env.CRON_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        // 1. Delivered 3+ days ago and still unconfirmed: stop reminding, flag for admin.
        const flagged = await pool.query(
            `UPDATE orders SET flagged_overdue_at = now()
             WHERE status = 'paid' AND flagged_overdue_at IS NULL
               AND EXISTS (
                   SELECT 1 FROM order_items oi
                   WHERE oi.order_id = orders.id AND oi.delivered_at < now() - interval '3 days'
                     AND oi.buyer_confirmed_at IS NULL AND oi.status <> 'cancelled'
               )
             RETURNING id`
        );

        // 2. Reminder every 6 hours. The UPDATE claims the order, so overlapping runs can't double-send.
        const due = await pool.query(
            `UPDATE orders o SET last_delivery_reminder_at = now()
             FROM users u
             WHERE u.id = o.buyer_id AND o.status = 'paid' AND o.delivered_at IS NOT NULL
               AND o.flagged_overdue_at IS NULL AND o.reported_at IS NULL
               AND (o.last_delivery_reminder_at IS NULL OR o.last_delivery_reminder_at < now() - interval '6 hours')
               AND EXISTS (
                   SELECT 1 FROM order_items oi
                   WHERE oi.order_id = o.id AND oi.buyer_confirmed_at IS NULL AND oi.status <> 'cancelled' AND oi.delivered_at IS NOT NULL
               )
             RETURNING o.id, o.buyer_id, o.delivered_at, o.delivery_sms_reminder_sent, u.sms_number`
        );

        for (const o of due.rows) {
            await insertNotification(
                o.buyer_id,
                'delivery_reminder_buyer',
                `⏰ Did Order #${o.id} arrive? Confirm it in your Orders tab so the seller gets paid, or report a problem.`,
                o.id,
                '/dashboard?tab=orders'
            );

            // SMS only once more, on day 2 (the first SMS already goes out when the seller marks delivered).
            const twoDaysOld = new Date(o.delivered_at).getTime() < Date.now() - 2 * 24 * 60 * 60 * 1000;
            if (twoDaysOld && !o.delivery_sms_reminder_sent && o.sms_number) {
                sendOrderSMS(o.sms_number, `Tre-X: Did Order #${o.id} arrive? Open the app and confirm it, or report a problem.`)
                    .catch((err) => console.error('Reminder SMS failed:', err));
                await pool.query('UPDATE orders SET delivery_sms_reminder_sent = true WHERE id = $1', [o.id]);
            }
        }

        res.json({ flagged: flagged.rows.length, reminded: due.rows.length });
    } catch (err) {
        console.error('Delivery reminders error:', err);
        res.status(500).json({ error: 'Reminder run failed' });
    }
});

module.exports = router;