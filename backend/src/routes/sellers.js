const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ... (reconcilePayments, getSuccessfulPurchaseCount, REWARD_* consts,
//      checkAndCreditRewards, isSellerRestricted all stay exactly as they are) ...

// Returns the % change from `previous` to `current`, rounded to 1 decimal.
// Returns null when there's no meaningful baseline to compare against
// (previous === 0 and current > 0 is "infinite" growth, not a real %).
function computePercentChange(current, previous) {
    if (previous === 0) {
        return current === 0 ? 0 : null;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

// GET /api/sellers/overview?period=week|month|6months|year|all
router.get('/overview', requireAuth, async (req, res) => {
    try {
        await reconcilePayments(req.userId);

        // Interval strings only — used both to build the current-period
        // filter and (doubled) the previous-period filter below.
        const periodIntervals = {
            week: '7 days',
            month: '1 month',
            '6months': '6 months',
            year: '1 year',
        };
        const intervalStr = periodIntervals[req.query.period];
        const isAllTime = !intervalStr; // 'all' or unrecognized => no filter, same as before

        const dateFilter = intervalStr
            ? `created_at >= now() - interval '${intervalStr}'`
            : '1=1';

        const salesResult = await pool.query(
            `SELECT
                COUNT(*)::int AS successful_sales,
                COALESCE(SUM(price_at_purchase * quantity), 0) AS gross_sales,
                COALESCE(SUM(platform_fee), 0) AS platform_fees,
                COALESCE(SUM(seller_earnings), 0) AS net_earnings
             FROM order_items
             WHERE seller_id = $1 AND buyer_confirmed_at IS NOT NULL AND ${dateFilter}`,
            [req.userId]
        );

        // ─── PERIOD-OVER-PERIOD / ALL-TIME GROWTH ──────────────────────
        let netChangePercentage = null;

        if (!isAllTime) {
            // Same-length window immediately before the current one.
            // e.g. period=month → compare last 1 month vs the 1 month before that.
            const prevResult = await pool.query(
                `SELECT COALESCE(SUM(seller_earnings), 0) AS net_earnings
                 FROM order_items
                 WHERE seller_id = $1
                   AND buyer_confirmed_at IS NOT NULL
                   AND created_at >= now() - interval '${intervalStr}' * 2
                   AND created_at < now() - interval '${intervalStr}'`,
                [req.userId]
            );
            const currentNet = parseFloat(salesResult.rows[0].net_earnings);
            const previousNet = parseFloat(prevResult.rows[0].net_earnings);
            netChangePercentage = computePercentChange(currentNet, previousNet);
        } else {
            // "All time" growth: split the seller's whole selling history at
            // its midpoint and compare the earlier half's net earnings to
            // the later half's — an overall growth trend rather than a
            // recent swing.
            const rangeResult = await pool.query(
                `SELECT MIN(created_at) AS min_date, MAX(created_at) AS max_date
                 FROM order_items
                 WHERE seller_id = $1 AND buyer_confirmed_at IS NOT NULL`,
                [req.userId]
            );
            const { min_date, max_date } = rangeResult.rows[0];

            if (min_date && max_date && min_date.getTime() !== max_date.getTime()) {
                const midpoint = new Date(
                    min_date.getTime() + (max_date.getTime() - min_date.getTime()) / 2
                );
                const halvesResult = await pool.query(
                    `SELECT
                        COALESCE(SUM(seller_earnings) FILTER (WHERE created_at < $2), 0) AS earlier_half,
                        COALESCE(SUM(seller_earnings) FILTER (WHERE created_at >= $2), 0) AS later_half
                     FROM order_items
                     WHERE seller_id = $1 AND buyer_confirmed_at IS NOT NULL`,
                    [req.userId, midpoint]
                );
                const earlier = parseFloat(halvesResult.rows[0].earlier_half);
                const later = parseFloat(halvesResult.rows[0].later_half);
                netChangePercentage = computePercentChange(later, earlier);
            }
            // If there's only one sale (or none), min_date === max_date or is
            // null — leave netChangePercentage as null, nothing to compare.
        }

        const rewardsResult = await pool.query(
            `SELECT COALESCE(SUM(reward_amount), 0) AS total_rewards
             FROM seller_rewards WHERE seller_id = $1 AND credited = TRUE`,
            [req.userId]
        );

        const listingsResult = await pool.query(
            'SELECT COUNT(*)::int AS active_listings FROM products WHERE seller_id = $1',
            [req.userId]
        );

        const paymentResult = await pool.query(
            `SELECT COALESCE(SUM(amount_due - amount_paid), 0) AS pending_due
             FROM seller_payments WHERE seller_id = $1 AND status != 'paid'`,
            [req.userId]
        );

        const restrictedResult = await pool.query(
            `SELECT 1 FROM seller_payments WHERE seller_id = $1 AND status = 'overdue' LIMIT 1`,
            [req.userId]
        );

        res.json({
            ...salesResult.rows[0],
            net_change_percentage: netChangePercentage,
            total_rewards: rewardsResult.rows[0].total_rewards,
            active_listings: listingsResult.rows[0].active_listings,
            pending_payment_due: paymentResult.rows[0].pending_due,
            restricted: restrictedResult.rows.length > 0,
        });
    } catch (err) {
        console.error('Get overview error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your overview' });
    }
});

// Ensures every past calendar month with confirmed sales has a
// seller_payments row (created as 'pending' the first time it's checked).
async function reconcilePayments(sellerId) {
    const monthsResult = await pool.query(
        `SELECT
            date_trunc('month', o.created_at)::date AS period_start,
            (date_trunc('month', o.created_at) + interval '1 month - 1 day')::date AS period_end,
            SUM(oi.platform_fee) AS amount_due
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.seller_id = $1
           AND oi.buyer_confirmed_at IS NOT NULL
           AND date_trunc('month', o.created_at) < date_trunc('month', now())
         GROUP BY 1, 2`,
        [sellerId]
    );
for (const row of monthsResult.rows) {
        // Only apply available credit the first time this period's row is created —
        // ON CONFLICT DO NOTHING means this whole block is a no-op on repeat runs,
        // so credit only ever gets spent once per period.
        const alreadyExists = await pool.query(
            'SELECT 1 FROM seller_payments WHERE seller_id = $1 AND period_start = $2 AND period_end = $3',
            [sellerId, row.period_start, row.period_end]
        );
        if (alreadyExists.rows.length > 0) continue;

        const userResult = await pool.query('SELECT credit_balance FROM users WHERE id = $1', [sellerId]);
        const availableCredit = parseFloat(userResult.rows[0]?.credit_balance || 0);
        const rawDue = parseFloat(row.amount_due);
        const creditApplied = Math.min(availableCredit, rawDue);
        const netDue = Math.round((rawDue - creditApplied) * 100) / 100;

        if (creditApplied > 0) {
            await pool.query('UPDATE users SET credit_balance = credit_balance - $1 WHERE id = $2', [creditApplied, sellerId]);
        }

        await pool.query(
            `INSERT INTO seller_payments (seller_id, period_start, period_end, amount_due, status, amount_paid)
             VALUES ($1, $2, $3, $4, 'pending', $5)`,
            [sellerId, row.period_start, row.period_end, rawDue, creditApplied]
        );
    }

    await pool.query(
        `UPDATE seller_payments
         SET status = 'overdue'
         WHERE seller_id = $1 AND status = 'pending' AND period_end < now() AND amount_paid < amount_due`,
        [sellerId]
    );
}

async function getSuccessfulPurchaseCount(sellerId) {
    const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM order_items WHERE seller_id = $1 AND buyer_confirmed_at IS NOT NULL`,
        [sellerId]
    );
    return result.rows[0].count;
}

const REWARD_MILESTONE_INTERVAL = 30;
const REWARD_PERCENTAGE = 0.5; // %

// Checks if the seller has hit a new 30-sale milestone since we last checked,
// and if so, credits a reward based on their earnings across that batch of 30 sales.
async function checkAndCreditRewards(sellerId) {
    const count = await getSuccessfulPurchaseCount(sellerId);
    const milestonesEarned = Math.floor(count / REWARD_MILESTONE_INTERVAL);

    if (milestonesEarned === 0) return;

    const existingResult = await pool.query(
        'SELECT milestone FROM seller_rewards WHERE seller_id = $1',
        [sellerId]
    );
    const alreadyCredited = new Set(existingResult.rows.map((r) => r.milestone));

    for (let i = 1; i <= milestonesEarned; i++) {
        const milestone = i * REWARD_MILESTONE_INTERVAL;
        if (alreadyCredited.has(milestone)) continue;

        const earningsResult = await pool.query(
            `SELECT COALESCE(SUM(seller_earnings), 0) AS total
             FROM (
                SELECT seller_earnings FROM order_items
                WHERE seller_id = $1 AND buyer_confirmed_at IS NOT NULL
                ORDER BY buyer_confirmed_at ASC
                LIMIT $2 OFFSET $3
             ) batch`,
            [sellerId, REWARD_MILESTONE_INTERVAL, milestone - REWARD_MILESTONE_INTERVAL]
        );
        const batchEarnings = parseFloat(earningsResult.rows[0].total);
        const rewardAmount = Math.round(batchEarnings * (REWARD_PERCENTAGE / 100) * 100) / 100;

        await pool.query(
            `INSERT INTO seller_rewards (seller_id, milestone, reward_percentage, reward_amount, credited)
             VALUES ($1, $2, $3, $4, TRUE)
             ON CONFLICT (seller_id, milestone) DO NOTHING`,
            [sellerId, milestone, REWARD_PERCENTAGE, rewardAmount]
        );
    }
}

async function isSellerRestricted(sellerId) {
    await reconcilePayments(sellerId);
    const result = await pool.query(
        `SELECT 1 FROM seller_payments WHERE seller_id = $1 AND status = 'overdue' LIMIT 1`,
        [sellerId]
    );
    return result.rows.length > 0;
}

// GET /api/sellers/overview?period=week|month|6months|year|all
router.get('/overview', requireAuth, async (req, res) => {
    try {
        await reconcilePayments(req.userId);

        const periodMap = {
            week: "created_at >= now() - interval '7 days'",
            month: "created_at >= now() - interval '1 month'",
            '6months': "created_at >= now() - interval '6 months'",
            year: "created_at >= now() - interval '1 year'",
        };
        const dateFilter = periodMap[req.query.period] || '1=1'; // 'all' or anything unrecognized = no filter

        const salesResult = await pool.query(
            `SELECT
                COUNT(*)::int AS successful_sales,
                COALESCE(SUM(price_at_purchase * quantity), 0) AS gross_sales,
                COALESCE(SUM(platform_fee), 0) AS platform_fees,
                COALESCE(SUM(seller_earnings), 0) AS net_earnings
             FROM order_items
             WHERE seller_id = $1 AND buyer_confirmed_at IS NOT NULL AND ${dateFilter}`,
            [req.userId]
        );

        const rewardsResult = await pool.query(
            `SELECT COALESCE(SUM(reward_amount), 0) AS total_rewards
             FROM seller_rewards WHERE seller_id = $1 AND credited = TRUE`,
            [req.userId]
        );

        const listingsResult = await pool.query(
            'SELECT COUNT(*)::int AS active_listings FROM products WHERE seller_id = $1',
            [req.userId]
        );

        const paymentResult = await pool.query(
            `SELECT COALESCE(SUM(amount_due - amount_paid), 0) AS pending_due
             FROM seller_payments WHERE seller_id = $1 AND status != 'paid'`,
            [req.userId]
        );

        const restrictedResult = await pool.query(
            `SELECT 1 FROM seller_payments WHERE seller_id = $1 AND status = 'overdue' LIMIT 1`,
            [req.userId]
        );

        res.json({
            ...salesResult.rows[0],
            total_rewards: rewardsResult.rows[0].total_rewards,
            active_listings: listingsResult.rows[0].active_listings,
            pending_payment_due: paymentResult.rows[0].pending_due,
            restricted: restrictedResult.rows.length > 0,
        });
    } catch (err) {
        console.error('Get overview error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your overview' });
    }
});

// GET /api/sellers/rewards — progress toward next milestone + reward history
router.get('/rewards', requireAuth, async (req, res) => {
    try {
        const count = await getSuccessfulPurchaseCount(req.userId);
        const currentProgress = count % REWARD_MILESTONE_INTERVAL;

        const historyResult = await pool.query(
            'SELECT * FROM seller_rewards WHERE seller_id = $1 ORDER BY milestone DESC',
            [req.userId]
        );

        res.json({
            successful_purchases: count,
            progress: currentProgress,
            next_milestone: REWARD_MILESTONE_INTERVAL,
            rewards: historyResult.rows,
        });
    } catch (err) {
        console.error('Get rewards error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your rewards' });
    }
});

// GET /api/sellers/purchase-count — total confirmed sales for the logged-in seller
router.get('/purchase-count', requireAuth, async (req, res) => {
    try {
        const count = await getSuccessfulPurchaseCount(req.userId);
        res.json({ count });
    } catch (err) {
        console.error('Get purchase count error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your purchase count' });
    }
});

// GET /api/sellers/payment-status
router.get('/payment-status', requireAuth, async (req, res) => {
    try {
        await reconcilePayments(req.userId);

        const currentMonthResult = await pool.query(
            `SELECT COALESCE(SUM(oi.platform_fee), 0) AS amount_due
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = $1
               AND oi.buyer_confirmed_at IS NOT NULL
               AND date_trunc('month', o.created_at) = date_trunc('month', now())`,
            [req.userId]
        );

        const historyResult = await pool.query(
            `SELECT * FROM seller_payments WHERE seller_id = $1 ORDER BY period_start DESC`,
            [req.userId]
        );

        const restricted = historyResult.rows.some((p) => p.status === 'overdue');

        res.json({
            current_month_due: currentMonthResult.rows[0].amount_due,
            history: historyResult.rows,
            restricted,
        });
    } catch (err) {
        console.error('Get payment status error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your payment status' });
    }
});

// POST /api/sellers/payment-status/:paymentId/pay — demo "pay now" (no real gateway yet)
router.post('/payment-status/:paymentId/pay', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE seller_payments
             SET amount_paid = amount_due, status = 'paid', paid_at = now()
             WHERE id = $1 AND seller_id = $2
             RETURNING *`,
            [req.params.paymentId, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Payment record not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Pay seller payment error:', err);
        res.status(500).json({ error: 'Something went wrong recording your payment' });
    }
});

// ... (all other routes — /rewards, /purchase-count, /payment-status, POST /pay — unchanged) ...

module.exports = router;
module.exports.isSellerRestricted = isSellerRestricted;
module.exports.reconcilePayments = reconcilePayments;
module.exports.getSuccessfulPurchaseCount = getSuccessfulPurchaseCount;
module.exports.checkAndCreditRewards = checkAndCreditRewards;