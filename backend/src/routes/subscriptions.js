const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction } = require('../utils/paystack');

const router = express.Router();

// Keep this in sync with PLANS in the frontend (src/pages/Home.jsx)
const PLAN_PRICES = {
    pro: { amountGHS: 25, label: 'Pro' },
    premium: { amountGHS: 240, label: 'Premium' },
};

const PLAN_DURATIONS = {
    pro: { days: 30 },
    premium: { days: 365 },
};
// POST /api/subscriptions/initiate
router.post('/initiate', requireAuth, async (req, res) => {
    const { plan } = req.body;

    const planConfig = PLAN_PRICES[plan];
    if (!planConfig) {
        return res.status(400).json({ error: 'Invalid plan selected' });
    }

    try {
        const userResult = await pool.query(
            'SELECT university_email, personal_email FROM users WHERE id = $1',
            [req.userId]
        );
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        const email = user.personal_email || user.university_email;
        // 'sub_' prefix lets the shared webhook in orders.js tell subscription
        // payments apart from order payments (which use 'cc_' + order id).
        const reference = `sub_${req.userId}_${crypto.randomBytes(6).toString('hex')}`;

        await pool.query(
            `INSERT INTO subscriptions (user_id, plan, status, paystack_reference, amount)
             VALUES ($1, $2, 'pending', $3, $4)`,
            [req.userId, plan, reference, planConfig.amountGHS]
        );

        const paystackRes = await initializeTransaction({
            email,
            amountGHS: planConfig.amountGHS,
            reference,
            metadata: { user_id: req.userId, plan },
            callback_url: `${process.env.CORS_ORIGIN}/subscription/callback`,
        });

        res.json({
            authorization_url: paystackRes.data.authorization_url,
            reference,
        });
    } catch (err) {
        console.error('Subscription initiate error:', err);
        res.status(500).json({ error: 'Could not start subscription payment' });
    }
});

// Called by orders.js's webhook when event.data.reference starts with 'sub_'.
// Not mounted as its own route — Paystack only has ONE webhook URL configured
// (/api/orders/webhook), which already handles order payments.
async function processSubscriptionWebhookEvent(event) {
    if (event.event !== 'charge.success') return;

    const { reference, status, amount } = event.data;

    const subResult = await pool.query(
        'SELECT * FROM subscriptions WHERE paystack_reference = $1',
        [reference]
    );
    const subscription = subResult.rows[0];

    if (!subscription) {
        console.warn(`Webhook: no subscription found for reference ${reference}`);
        return;
    }

    // Idempotency — Paystack can send the same event more than once.
    if (subscription.status === 'active') return;

    if (status !== 'success') {
        await pool.query(`UPDATE subscriptions SET status = 'failed' WHERE id = $1`, [subscription.id]);
        return;
    }

    const expectedPesewas = Math.round(Number(subscription.amount) * 100);
    if (amount !== expectedPesewas) {
        console.error(`Webhook: amount mismatch for ${reference}. Expected ${expectedPesewas}, got ${amount}`);
        await pool.query(`UPDATE subscriptions SET status = 'amount_mismatch' WHERE id = $1`, [subscription.id]);
        return;
    }

    const duration = PLAN_DURATIONS[subscription.plan];
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + duration.days * 24 * 60 * 60 * 1000);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE subscriptions SET status = 'active', starts_at = $1, ends_at = $2 WHERE id = $3`,
            [startsAt, endsAt, subscription.id]
        );
        await client.query(
            `UPDATE users SET plan = $1, plan_expires_at = $2 WHERE id = $3`,
            [subscription.plan, endsAt, subscription.user_id]
        );
        await client.query('COMMIT');
        console.log(`Subscription activated for user ${subscription.user_id}: ${subscription.plan} until ${endsAt}`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// GET /api/subscriptions/status/:reference — used by the callback page to poll
// until the webhook has finished activating the subscription.
router.get('/status/:reference', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT status, plan FROM subscriptions WHERE paystack_reference = $1 AND user_id = $2',
            [req.params.reference, req.userId]
        );
        const subscription = result.rows[0];
        if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
        res.json({ status: subscription.status, plan: subscription.plan });
    } catch (err) {
        console.error('Get subscription status error:', err);
        res.status(500).json({ error: 'Could not check subscription status' });
    }
});

module.exports = router;
module.exports.processSubscriptionWebhookEvent = processSubscriptionWebhookEvent;