const cron = require('node-cron');
const crypto = require('crypto');
const pool = require('../db/pool');
const { chargeAuthorization } = require('../utils/paystack');
const { insertNotification } = require('../utils/notifications');

const PLAN_PRICES = {
    pro: { amountGHS: 25, label: 'Pro' },
    premium: { amountGHS: 240, label: 'Premium' },
};

const PLAN_DURATIONS_MS = {
    pro: 30 * 24 * 60 * 60 * 1000,
    premium: 365 * 24 * 60 * 60 * 1000,
};

const WARNING_DAYS_BEFORE = 3;

// ─── 1. Warn users whose plan expires in ~3 days ───
async function sendExpiryWarnings() {
    const windowStart = new Date();
    const windowEnd = new Date(Date.now() + WARNING_DAYS_BEFORE * 24 * 60 * 60 * 1000);

    const result = await pool.query(
        `SELECT u.id AS user_id, u.plan, u.pending_plan, u.plan_expires_at, s.id AS subscription_id
         FROM users u
         JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
         WHERE u.plan_expires_at BETWEEN $1 AND $2
           AND s.renewal_warning_sent_at IS NULL
           AND s.authorization_code IS NOT NULL`,
        [windowStart, windowEnd]
    );

    for (const row of result.rows) {
        const dateStr = new Date(row.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        if (row.pending_plan === 'free') {
            await insertNotification(
                row.user_id,
                'plan_cancel_warning',
                `Your subscription ends on ${dateStr}. Your account will move to the Free plan.`,
                row.subscription_id,
                '/settings'
            ).catch((err) => console.error('Cancel warning notification error:', err));
            await pool.query(`UPDATE subscriptions SET renewal_warning_sent_at = now() WHERE id = $1`, [row.subscription_id]);
            continue;
        }

        const nextPlan = row.pending_plan || row.plan;
        const price = PLAN_PRICES[nextPlan]?.amountGHS;
        const label = PLAN_PRICES[nextPlan]?.label || nextPlan;

        await insertNotification(
            row.user_id,
            'plan_renewal_warning',
            `Your plan renews on ${dateStr} — GHS ${price} will be charged to your card for ${label}.`,
            row.subscription_id,
            '/settings'
        ).catch((err) => console.error('Renewal warning notification error:', err));

        await pool.query(
            `UPDATE subscriptions SET renewal_warning_sent_at = now() WHERE id = $1`,
            [row.subscription_id]
        );
    }

    if (result.rows.length > 0) {
        console.log(`Sent ${result.rows.length} renewal warning(s)`);
    }
}

// ─── 2. Charge and renew plans that have expired ───
async function processExpiredPlans() {
    const result = await pool.query(
        `SELECT u.id AS user_id, u.plan, u.pending_plan, u.plan_expires_at, u.personal_email, u.university_email,
                s.id AS subscription_id, s.authorization_code
         FROM users u
         JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
         WHERE u.plan_expires_at <= now()`
    );

    for (const row of result.rows) {
        const nextPlan = row.pending_plan || row.plan;

        // Cancellation — revert to Free, no charge.
        if (row.pending_plan === 'free') {
            await pool.query(
                `UPDATE users SET plan = 'free', plan_expires_at = NULL, pending_plan = NULL WHERE id = $1`,
                [row.user_id]
            );
            await pool.query(`UPDATE subscriptions SET status = 'cancelled' WHERE id = $1`, [row.subscription_id]);
            await insertNotification(
                row.user_id,
                'plan_cancelled',
                `Your subscription has ended as requested. Your account is now on the Free plan.`,
                row.subscription_id,
                '/settings'
            ).catch((err) => console.error('Cancel notification error:', err));
            continue;
        }

        const planConfig = PLAN_PRICES[nextPlan];
        const email = row.personal_email || row.university_email;

        // No saved card — can't auto-charge. Revert to Free.
        if (!row.authorization_code) {
            await pool.query(
                `UPDATE users SET plan = 'free', plan_expires_at = NULL, pending_plan = NULL WHERE id = $1`,
                [row.user_id]
            );
            await pool.query(`UPDATE subscriptions SET status = 'expired' WHERE id = $1`, [row.subscription_id]);
            await insertNotification(
                row.user_id,
                'plan_expired',
                `Your plan expired and we couldn't find a saved card to renew it, so your account moved to Free.`,
                row.subscription_id,
                '/settings'
            ).catch((err) => console.error('Plan expired notification error:', err));
            continue;
        }

        const reference = `sub_renew_${row.user_id}_${crypto.randomBytes(6).toString('hex')}`;

        try {
            const chargeRes = await chargeAuthorization({
                email,
                amountGHS: planConfig.amountGHS,
                authorization_code: row.authorization_code,
                reference,
                metadata: { user_id: row.user_id, plan: nextPlan, renewal: true },
            });

            const startsAt = new Date();
            const endsAt = new Date(startsAt.getTime() + PLAN_DURATIONS_MS[nextPlan]);

            if (chargeRes.data.status === 'success') {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    await client.query(`UPDATE subscriptions SET status = 'renewed' WHERE id = $1`, [row.subscription_id]);
                    await client.query(
                        `INSERT INTO subscriptions (user_id, plan, status, paystack_reference, amount, starts_at, ends_at, authorization_code)
                         VALUES ($1, $2, 'active', $3, $4, $5, $6, $7)`,
                        [row.user_id, nextPlan, reference, planConfig.amountGHS, startsAt, endsAt, row.authorization_code]
                    );
                    await client.query(
                        `UPDATE users SET plan = $1, plan_expires_at = $2, pending_plan = NULL WHERE id = $3`,
                        [nextPlan, endsAt, row.user_id]
                    );
                    await client.query('COMMIT');
                } catch (err) {
                    await client.query('ROLLBACK');
                    throw err;
                } finally {
                    client.release();
                }

                await insertNotification(
                    row.user_id,
                    'plan_renewed',
                    `Your ${planConfig.label} plan was renewed. GHS ${planConfig.amountGHS} was charged to your card.`,
                    row.subscription_id,
                    '/settings'
                ).catch((err) => console.error('Plan renewed notification error:', err));
            } else {
                throw new Error(`Charge status: ${chargeRes.data.status}`);
            }
        } catch (err) {
            console.error(`Renewal charge failed for user ${row.user_id}:`, err.message);
            await pool.query(
                `UPDATE users SET plan = 'free', plan_expires_at = NULL, pending_plan = NULL WHERE id = $1`,
                [row.user_id]
            );
            await pool.query(`UPDATE subscriptions SET status = 'renewal_failed' WHERE id = $1`, [row.subscription_id]);
            await insertNotification(
                row.user_id,
                'plan_renewal_failed',
                `We couldn't charge your card to renew your plan, so your account moved to Free. Please resubscribe.`,
                row.subscription_id,
                '/settings'
            ).catch((e) => console.error('Renewal failed notification error:', e));
        }
    }

    if (result.rows.length > 0) {
        console.log(`Processed ${result.rows.length} expired plan(s)`);
    }
}

function startSubscriptionRenewalJobs() {
    // Runs once a day at 03:00 server time
    cron.schedule('0 3 * * *', async () => {
        try {
            await sendExpiryWarnings();
            await processExpiredPlans();
        } catch (err) {
            console.error('Subscription renewal job error:', err);
        }
    });
    console.log('Subscription renewal cron job scheduled');
}

module.exports = { startSubscriptionRenewalJobs };