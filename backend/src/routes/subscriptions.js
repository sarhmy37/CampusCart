const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction, paystackRequest } = require('../utils/paystack');
const { insertNotification } = require('../utils/notifications');

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

// Shared activation logic — called from both the webhook and the direct-verify
// endpoint below, so a payment can be confirmed via whichever path responds
// first without double-processing (idempotent on subscription.status).
async function activateSubscriptionIfValid(reference, paystackStatus, amountPesewas, authorizationCode) {
    const subResult = await pool.query(
        'SELECT * FROM subscriptions WHERE paystack_reference = $1',
        [reference]
    );
    const subscription = subResult.rows[0];

    if (!subscription) {
        console.warn(`Activation: no subscription found for reference ${reference}`);
        return { found: false };
    }

    // Idempotency — webhook and direct-verify can both fire for the same payment.
    if (subscription.status === 'active') {
        return { found: true, status: 'active', plan: subscription.plan };
    }

    if (paystackStatus !== 'success') {
        await pool.query(`UPDATE subscriptions SET status = 'failed' WHERE id = $1`, [subscription.id]);
        return { found: true, status: 'failed' };
    }

    const expectedPesewas = Math.round(Number(subscription.amount) * 100);
    if (amountPesewas !== expectedPesewas) {
        console.error(`Activation: amount mismatch for ${reference}. Expected ${expectedPesewas}, got ${amountPesewas}`);
        await pool.query(`UPDATE subscriptions SET status = 'amount_mismatch' WHERE id = $1`, [subscription.id]);
        return { found: true, status: 'amount_mismatch' };
    }

    const duration = PLAN_DURATIONS[subscription.plan];
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + duration.days * 24 * 60 * 60 * 1000);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE subscriptions SET status = 'active', starts_at = $1, ends_at = $2, authorization_code = COALESCE($4, authorization_code) WHERE id = $3`,
            [startsAt, endsAt, subscription.id, authorizationCode || null]
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

    const planLabel = subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1);
    await insertNotification(
        subscription.user_id,
        'subscription_activated',
        `Your ${planLabel} plan is now active! It's valid until ${endsAt.toLocaleDateString()}.`,
        subscription.id,
        '/settings'
    ).catch((err) => console.error('Subscription notification error:', err));

    return { found: true, status: 'active', plan: subscription.plan };
}

// Called by orders.js's webhook when event.data.reference starts with 'sub_'.
// Not mounted as its own route — Paystack only has ONE webhook URL configured
// (/api/orders/webhook), which already handles order payments.
async function processSubscriptionWebhookEvent(event) {
    if (event.event !== 'charge.success') return;
    const { reference, status, amount, authorization } = event.data;
    await activateSubscriptionIfValid(reference, status, amount, authorization?.authorization_code);
}

// POST /api/subscriptions/verify/:reference — called directly by the callback
// page right after Paystack redirects back, so activation doesn't have to
// wait on the webhook (which can lag behind on a cold-starting free-tier
// backend, or occasionally fail delivery). Asks Paystack itself whether the
// payment succeeded, rather than trusting only our own webhook's timing.
router.post('/verify/:reference', requireAuth, async (req, res) => {
    const { reference } = req.params;

    try {
        const subCheck = await pool.query(
            'SELECT id, user_id, status, plan FROM subscriptions WHERE paystack_reference = $1',
            [reference]
        );
        const subscription = subCheck.rows[0];
        if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
        if (subscription.user_id !== req.userId) return res.status(403).json({ error: 'Not your subscription' });

        if (subscription.status === 'active') {
            return res.json({ status: 'active', plan: subscription.plan });
        }

        const verifyRes = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, {
            method: 'GET',
        });

        const result = await activateSubscriptionIfValid(reference, verifyRes.data.status, verifyRes.data.amount, verifyRes.data.authorization?.authorization_code);
        res.json({ status: result.status || 'pending', plan: result.plan });
    } catch (err) {
        console.error('Direct verify error:', err);
        res.status(500).json({ error: 'Could not verify payment' });
    }
});

// GET /api/subscriptions/status/:reference — kept as a lightweight fallback
// (e.g. re-checking status on a page refresh without re-hitting Paystack).
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

// POST /api/subscriptions/schedule-downgrade — Premium → Pro only. No charge now;
// the switch applies automatically once the current period ends (handled lazily
// in GET /api/auth/me, same pattern as the referral_code backfill there).
router.post('/schedule-downgrade', requireAuth, async (req, res) => {
    const { plan } = req.body;
    if (plan !== 'pro') {
        return res.status(400).json({ error: 'Only downgrading to Pro is supported here' });
    }

    try {
        const userResult = await pool.query(
            'SELECT plan, plan_expires_at FROM users WHERE id = $1',
            [req.userId]
        );
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isActivePremium = user.plan === 'premium' &&
            user.plan_expires_at && new Date(user.plan_expires_at) > new Date();
        if (!isActivePremium) {
            return res.status(400).json({ error: 'You need an active Premium plan to schedule a downgrade' });
        }

        await pool.query('UPDATE users SET pending_plan = $1 WHERE id = $2', ['pro', req.userId]);
        res.json({ pending_plan: 'pro', effective_at: user.plan_expires_at });
    } catch (err) {
        console.error('Schedule downgrade error:', err);
        res.status(500).json({ error: 'Could not schedule the downgrade' });
    }
});

// POST /api/subscriptions/cancel — keeps access until period end, then reverts to Free.
router.post('/cancel', requireAuth, async (req, res) => {
    try {
        const userResult = await pool.query(
            'SELECT plan, plan_expires_at FROM users WHERE id = $1',
            [req.userId]
        );
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isActivePaid = user.plan && user.plan !== 'free' &&
            user.plan_expires_at && new Date(user.plan_expires_at) > new Date();
        if (!isActivePaid) {
            return res.status(400).json({ error: 'No active paid plan to cancel' });
        }

        await pool.query('UPDATE users SET pending_plan = $1 WHERE id = $2', ['free', req.userId]);
        res.json({ pending_plan: 'free', effective_at: user.plan_expires_at });
    } catch (err) {
        console.error('Cancel subscription error:', err);
        res.status(500).json({ error: 'Could not cancel subscription' });
    }
});

// POST /api/subscriptions/undo-cancel — user changed their mind before period end.
router.post('/undo-cancel', requireAuth, async (req, res) => {
    try {
        await pool.query(
            `UPDATE users SET pending_plan = NULL WHERE id = $1 AND pending_plan = 'free'`,
            [req.userId]
        );
        res.json({ message: 'Cancellation undone' });
    } catch (err) {
        console.error('Undo cancel error:', err);
        res.status(500).json({ error: 'Could not undo cancellation' });
    }
});

module.exports = router;
module.exports.processSubscriptionWebhookEvent = processSubscriptionWebhookEvent;