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
    const { product_ids, tier } = req.body;
    const seller_id = req.userId;

    if (!Array.isArray(product_ids) || product_ids.length === 0 || !tier || !BOOST_TIERS[tier]) {
        return res.status(400).json({ error: 'A valid product and boost tier are required.' });
    }

    const client = await pool.connect();
    try {
        const productsResult = await client.query(
            `SELECT id, title, seller_id FROM products WHERE id = ANY($1::uuid[])`,
            [product_ids]
        );
        const foundProducts = productsResult.rows;

        if (foundProducts.length !== product_ids.length) {
            client.release();
            return res.status(404).json({ error: 'One or more products were not found' });
        }

        const notOwned = foundProducts.find((p) => p.seller_id !== seller_id);
        if (notOwned) {
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
        if (activeBoostCount + product_ids.length > MAX_ACTIVE_BOOSTS) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(409).json({
                error: `Not enough boost slots available (${MAX_ACTIVE_BOOSTS - activeBoostCount} left). Please try again once one expires.`,
            });
        }

        const { price: pricePerItem } = BOOST_TIERS[tier];
        const totalPrice = pricePerItem * product_ids.length;
        const reference = `boost_${Date.now()}_${seller_id}`;

        const boostIds = [];
        for (let i = 0; i < product_ids.length; i++) {
            const rowReference = `${reference}_${i}`;
            const boostResult = await client.query(
                `INSERT INTO boosts (product_id, seller_id, tier, amount, payment_reference, status)
                 VALUES ($1, $2, $3, $4, $5, 'pending_payment')
                 RETURNING id`,
                [product_ids[i], seller_id, tier, pricePerItem, rowReference]
            );
            boostIds.push(boostResult.rows[0].id);
        }

        await client.query('COMMIT');
        client.release();

        const userResult = await pool.query(
            `SELECT personal_email, university_email FROM users WHERE id = $1`,
            [seller_id]
        );
        const sellerEmail = userResult.rows[0]?.personal_email || userResult.rows[0]?.university_email;
        if (!sellerEmail) {
            await pool.query(`DELETE FROM boosts WHERE id = ANY($1::uuid[])`, [boostIds]);
            return res.status(400).json({ error: 'No email found for user. Please update your profile.' });
        }

        const paystackRes = await initializeTransaction({
            email: sellerEmail,
            amountGHS: totalPrice,
            reference,
            callback_url: `${process.env.CORS_ORIGIN}/browse?boost_ref=${reference}`,
            metadata: { boost_ids: boostIds, seller_id, product_ids, tier },
        });

        res.status(201).json({
            boost_ids: boostIds,
            product_titles: foundProducts.map((p) => p.title),
            amount: totalPrice,
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
            `SELECT status, product_id FROM boosts WHERE payment_reference LIKE $1 AND seller_id = $2`,
            [`${req.params.reference}_%`, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Boost not found' });
        const allConfirmed = result.rows.every((r) => r.status === 'confirmed');
        res.json({
            status: allConfirmed ? 'confirmed' : result.rows[0].status,
            product_id: result.rows[0].product_id,
        });
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
        const boostsResult = await pool.query(
            `SELECT * FROM boosts WHERE payment_reference LIKE $1 AND status = 'pending_payment'`,
            [`${reference}_%`]
        );
        const boosts = boostsResult.rows;
        if (boosts.length === 0) return; // already processed or not found

        const expectedTotal = boosts.reduce((sum, b) => sum + parseFloat(b.amount), 0);
        if (Math.abs(amountPaidGHS - expectedTotal) > 0.05) {
            console.error(`[BOOST AMOUNT MISMATCH] Reference ${reference}: expected GHS ${expectedTotal}, got GHS ${amountPaidGHS}`);
            return;
        }

        const seller_id = boosts[0].seller_id;
        const tier = boosts[0].tier;
        const { hours } = BOOST_TIERS[tier];
        const boostedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
        const boostIds = boosts.map((b) => b.id);
        const productIds = boosts.map((b) => b.product_id);

        await pool.query(
            `UPDATE boosts SET status = 'confirmed', boosted_until = $1 WHERE id = ANY($2::uuid[])`,
            [boostedUntil, boostIds]
        );

        await pool.query(
            `UPDATE products SET boosted_until = $1, boost_tier = $2 WHERE id = ANY($3::uuid[])`,
            [boostedUntil, tier, productIds]
        );

        const productsResult = await pool.query(`SELECT title FROM products WHERE id = ANY($1::uuid[])`, [productIds]);
        const titles = productsResult.rows.map((r) => r.title);
        const summary = titles.length === 1 ? `"${titles[0]}"` : `${titles.length} listings`;

        await insertNotification(
            seller_id,
            'boost_confirmed',
            `🚀 ${summary} boosted! They'll stay at the top of search and browse results for the next ${tier === '24h' ? '24 hours' : tier === '3d' ? '3 days' : '7 days'}.`,
            productIds[0],
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