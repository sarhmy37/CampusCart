const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction } = require('../utils/paystack');
const { insertNotification } = require('../utils/notifications');

const router = express.Router();

const BOOST_TIERS = {
    '24h': { price: 20, hours: 24 },
    '3d': { price: 45, hours: 72 },
    '7d': { price: 90, hours: 168 },
};

// ─── POST /api/boosts — create pending boost + get Paystack payment link ──
router.post('/', requireAuth, async (req, res) => {
    const { product_id, tier } = req.body;
    const seller_id = req.userId;

    if (!product_id || !tier || !BOOST_TIERS[tier]) {
        return res.status(400).json({ error: 'A valid product and boost tier are required.' });
    }

    const client = await pool.connect();
    try {
        const productResult = await client.query(
            `SELECT id, title, seller_id FROM products WHERE id = $1`,
            [product_id]
        );
        const product = productResult.rows[0];
        if (!product) {
            client.release();
            return res.status(404).json({ error: 'Product not found' });
        }

        if (product.seller_id !== seller_id) {
            client.release();
            return res.status(403).json({ error: 'You can only boost your own listings.' });
        }

        await client.query('BEGIN');

        // Advisory lock serializes every concurrent boost-creation request through
        // this single check, so two sellers can't both slip past a full cap at once.
        // Released automatically at COMMIT/ROLLBACK (end of this transaction).
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('boost_slot_check'))`);

        const activeBoostsResult = await client.query(
            `SELECT COUNT(*) FROM products WHERE boosted_until IS NOT NULL AND boosted_until > now()`
        );
        const activeBoostCount = parseInt(activeBoostsResult.rows[0].count, 10);
        const MAX_ACTIVE_BOOSTS = 6;
        if (activeBoostCount >= MAX_ACTIVE_BOOSTS) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(409).json({
                error: `All ${MAX_ACTIVE_BOOSTS} boost slots are currently taken. Please try again once one expires.`,
            });
        }

        const { price } = BOOST_TIERS[tier];
        const reference = `boost_${Date.now()}_${seller_id}`;

        const boostResult = await client.query(
            `INSERT INTO boosts (product_id, seller_id, tier, amount, payment_reference, status)
             VALUES ($1, $2, $3, $4, $5, 'pending_payment')
             RETURNING id`,
            [product_id, seller_id, tier, price, reference]
        );
        const boostId = boostResult.rows[0].id;

        await client.query('COMMIT');
        client.release();

        const userResult = await pool.query(
            `SELECT personal_email, university_email FROM users WHERE id = $1`,
            [seller_id]
        );
        const sellerEmail = userResult.rows[0]?.personal_email || userResult.rows[0]?.university_email;
        if (!sellerEmail) {
            await pool.query(`DELETE FROM boosts WHERE id = $1`, [boostId]);
            return res.status(400).json({ error: 'No email found for user. Please update your profile.' });
        }

        const paystackRes = await initializeTransaction({
            email: sellerEmail,
            amountGHS: price,
            reference,
            callback_url: `${process.env.CORS_ORIGIN}/browse?boost_ref=${reference}`,
            metadata: { boost_id: boostId, seller_id, product_id, tier },
        });

        res.status(201).json({
            boost_id: boostId,
            product_title: product.title,
            amount: price,
            authorization_url: paystackRes.data.authorization_url,
        });
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch {}
        client.release();
        console.error('Create boost error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ─── GET /api/boosts/status/:reference — poll boost confirmation ──────────
router.get('/status/:reference', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT status, product_id FROM boosts WHERE payment_reference = $1 AND seller_id = $2`,
            [req.params.reference, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Boost not found' });
        res.json({ status: result.rows[0].status, product_id: result.rows[0].product_id });
    } catch (err) {
        console.error('Get boost status error:', err);
        res.status(500).json({ error: 'Failed to check boost status' });
    }
});

// ─── Webhook processor (called from orders webhook dispatcher) ────────────
async function processBoostWebhookEvent(event) {
    const reference = event.data.reference;
    const amountPaidGHS = Math.round((event.data.amount / 100) * 100) / 100;

    try {
        const boostResult = await pool.query(
            `SELECT * FROM boosts WHERE payment_reference = $1 AND status = 'pending_payment'`,
            [reference]
        );
        const boost = boostResult.rows[0];
        if (!boost) return; // already processed or not found

        const expectedAmount = parseFloat(boost.amount);
        if (Math.abs(amountPaidGHS - expectedAmount) > 0.05) {
            console.error(`[BOOST AMOUNT MISMATCH] Boost ${boost.id}: expected GHS ${expectedAmount}, got GHS ${amountPaidGHS}`);
            return;
        }

        const { hours } = BOOST_TIERS[boost.tier];
        const boostedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

        await pool.query(
            `UPDATE boosts SET status = 'confirmed', boosted_until = $1 WHERE id = $2`,
            [boostedUntil, boost.id]
        );

        await pool.query(
            `UPDATE products SET boosted_until = $1, boost_tier = $2 WHERE id = $3`,
            [boostedUntil, boost.tier, boost.product_id]
        );

        const productResult = await pool.query(`SELECT title FROM products WHERE id = $1`, [boost.product_id]);
        const productTitle = productResult.rows[0]?.title || 'Your listing';

        await insertNotification(
            boost.seller_id,
            'boost_confirmed',
            `🚀 "${productTitle}" has been boosted! It'll stay at the top of search and browse results for the next ${boost.tier === '24h' ? '24 hours' : boost.tier === '3d' ? '3 days' : '7 days'}.`,
            boost.product_id,
            `/browse`
        );
    } catch (err) {
        console.error('Boost webhook processing error:', err);
    }
}

module.exports = {
    router,
    processBoostWebhookEvent,
};