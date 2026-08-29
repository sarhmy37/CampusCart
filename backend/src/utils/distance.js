const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction, verifyWebhookSignature } = require('../utils/paystack');
const { sendOrderSMS } = require('../utils/mailer');
const { calcDeliveryFee } = require('../utils/distance');

const router = express.Router();

const BUYER_FEE_RATE = 0.02;
const SELLER_FEE_RATE = 0.015;
const ADMIN_DELIVERY_SHARE = 0.20;
const SELLER_DELIVERY_SHARE = 0.80;
const PAYSTACK_MARKUP_RATE = 0.02;

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

    const verifyCheck = await pool.query('SELECT verified FROM users WHERE id = $1', [req.userId]);
    if (!verifyCheck.rows[0]?.verified) {
        return res.status(403).json({ error: 'Please verify your email before placing an order', needs_verification: true });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let subtotal = 0;
        const lineItems = [];
        // Now stores { school, deliveryPrices: { on_campus, near_campus, far_campus } } per seller,
        // taking the MAX of each tier across that seller's items in the cart.
        const sellerDeliveryInfo = {};

        for (const { product_id, quantity } of items) {
            const qty = Number(quantity) || 1;

            const productResult = await client.query(
                `SELECT p.id, p.title, p.price, p.stock, p.seller_id, u.school,
                        p.delivery_fee_on_campus, p.delivery_fee_near_campus, p.delivery_fee_far_campus
                 FROM products p JOIN users u ON u.id = p.seller_id
                 WHERE p.id = $1 FOR UPDATE OF p`,
                [product_id]
            );
            const product = productResult.rows[0];
            if (!product) throw { status: 404, message: 'A product in your cart no longer exists' };
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

        // ============ ONE DELIVERY FEE PER SELLER (not per item) ============
        let deliveryFee = 0;
        const deliveryFeeBySeller = {};
        if (delivery_method === 'delivery') {
            for (const [sellerId, info] of Object.entries(sellerDeliveryInfo)) {
                const { fee } = calcDeliveryFee(buyer_lat, buyer_lng, info.school, info);
                deliveryFee += fee;
                deliveryFeeBySeller[sellerId] = fee;
            }
        }

        // ============ 80/20 DELIVERY SPLIT ============
        const creditedDeliveryFor = new Set();
        for (const item of lineItems) {
            const totalDeliveryFee = deliveryFeeBySeller[item.seller_id];
            if (totalDeliveryFee && !creditedDeliveryFor.has(item.seller_id)) {
                const sellerDeliveryShare = Math.round(totalDeliveryFee * SELLER_DELIVERY_SHARE * 100) / 100;
                item.seller_earnings = Math.round((item.seller_earnings + sellerDeliveryShare) * 100) / 100;
                creditedDeliveryFor.add(item.seller_id);
            }
        }
        // ================================================

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

        const paystackAmount = Math.round(totalAmount * (1 + PAYSTACK_MARKUP_RATE) * 100) / 100;
        await client.query('UPDATE orders SET paystack_amount = $1 WHERE id = $2', [paystackAmount, orderId]);

        await client.query('COMMIT');

        const paystackRes = await initializeTransaction({
            email: buyerEmail,
            amountGHS: paystackAmount,
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

// ... (webhook, /mine, /sales, /deliveries, /:id, /:id/mark-delivered, /order-items/:itemId/confirm
//      routes are UNCHANGED from your existing file — no delivery-tier logic touches them)

module.exports = router;