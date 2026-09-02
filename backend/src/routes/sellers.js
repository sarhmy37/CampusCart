const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ─── HELPERS ──────────────────────────────────────────────────────────────

function computePercentChange(current, previous) {
    if (previous === 0) {
        return current === 0 ? 0 : null;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function getSuccessfulPurchaseCount(sellerId) {
    const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM order_items WHERE seller_id = $1 AND buyer_confirmed_at IS NOT NULL`,
        [sellerId]
    );
    return result.rows[0].count;
}

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

async function checkAndCreditRewards(sellerId) {
    const count = await getSuccessfulPurchaseCount(sellerId);
    const milestonesEarned = Math.floor(count / 30);

    if (milestonesEarned === 0) return;

    const existingResult = await pool.query(
        'SELECT milestone FROM seller_rewards WHERE seller_id = $1',
        [sellerId]
    );
    const alreadyCredited = new Set(existingResult.rows.map((r) => r.milestone));

    for (let i = 1; i <= milestonesEarned; i++) {
        const milestone = i * 30;
        if (alreadyCredited.has(milestone)) continue;

        const earningsResult = await pool.query(
            `SELECT COALESCE(SUM(seller_earnings), 0) AS total
             FROM (
                SELECT seller_earnings FROM order_items
                WHERE seller_id = $1 AND buyer_confirmed_at IS NOT NULL
                ORDER BY buyer_confirmed_at ASC
                LIMIT $2 OFFSET $3
             ) batch`,
            [sellerId, 30, milestone - 30]
        );
        const batchEarnings = parseFloat(earningsResult.rows[0].total);
        const rewardAmount = Math.round(batchEarnings * (0.5 / 100) * 100) / 100;

        await pool.query(
            `INSERT INTO seller_rewards (seller_id, milestone, reward_percentage, reward_amount, credited)
             VALUES ($1, $2, $3, $4, TRUE)
             ON CONFLICT (seller_id, milestone) DO NOTHING`,
            [sellerId, milestone, 0.5, rewardAmount]
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

// ─── BUSINESS PROFILE ROUTES ─────────────────────────────────────────────

// GET /api/sellers/business-profile — fetch existing business profile
router.get('/business-profile', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, user_id, profile_url, slug, created_at, updated_at
             FROM business_profiles
             WHERE user_id = $1`,
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No business profile found' });
        }

        res.json({
            profile_url: result.rows[0].profile_url,
            slug: result.rows[0].slug,
            created_at: result.rows[0].created_at,
        });
    } catch (err) {
        console.error('Get business profile error:', err);
        res.status(500).json({ error: 'Failed to fetch business profile' });
    }
});

// POST /api/sellers/business-profile — create a new business profile
router.post('/business-profile', requireAuth, async (req, res) => {
    try {
        // Check if user already has a profile
        const existing = await pool.query(
            `SELECT id FROM business_profiles WHERE user_id = $1`,
            [req.userId]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Business profile already exists' });
        }

        // Get the user's name to generate a slug
        const userResult = await pool.query(
            `SELECT name FROM users WHERE id = $1`,
            [req.userId]
        );

        const userName = userResult.rows[0]?.name || 'seller';
        const baseSlug = userName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seller';
        const uniqueSlug = `${baseSlug}-${req.userId.toString().slice(-6)}`;
        const clientUrl = process.env.CLIENT_URL || 'https://trex.app';
        const profileUrl = `${clientUrl}/seller/${uniqueSlug}`;

        const result = await pool.query(
            `INSERT INTO business_profiles (user_id, profile_url, slug, created_at, updated_at)
             VALUES ($1, $2, $3, now(), now())
             RETURNING id, profile_url, slug`,
            [req.userId, profileUrl, uniqueSlug]
        );

        res.status(201).json({
            profile_url: result.rows[0].profile_url,
            slug: result.rows[0].slug,
        });
    } catch (err) {
        console.error('Create business profile error:', err);
        res.status(500).json({ error: 'Failed to create business profile' });
    }
});

// ─── OVERVIEW ─────────────────────────────────────────────────────────────

// GET /api/sellers/overview?period=week|month|6months|year|all
router.get('/overview', requireAuth, async (req, res) => {
    try {
        await reconcilePayments(req.userId);

        const periodIntervals = {
            week: '7 days',
            month: '1 month',
            '6months': '6 months',
            year: '1 year',
        };
        const intervalStr = periodIntervals[req.query.period];
        const isAllTime = !intervalStr;

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

        let netChangePercentage = null;

        if (!isAllTime) {
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

// ─── REWARDS ──────────────────────────────────────────────────────────────

// GET /api/sellers/rewards — progress toward next milestone + reward history
router.get('/rewards', requireAuth, async (req, res) => {
    try {
        const count = await getSuccessfulPurchaseCount(req.userId);
        const currentProgress = count % 30;

        const historyResult = await pool.query(
            'SELECT * FROM seller_rewards WHERE seller_id = $1 ORDER BY milestone DESC',
            [req.userId]
        );

        res.json({
            successful_purchases: count,
            progress: currentProgress,
            next_milestone: 30,
            rewards: historyResult.rows,
        });
    } catch (err) {
        console.error('Get rewards error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your rewards' });
    }
});

// ─── PURCHASE COUNT ──────────────────────────────────────────────────────

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

// ─── PAYMENT STATUS ──────────────────────────────────────────────────────

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

// ─── EXPORTS ──────────────────────────────────────────────────────────────

module.exports = router;
module.exports.isSellerRestricted = isSellerRestricted;
module.exports.reconcilePayments = reconcilePayments;
module.exports.getSuccessfulPurchaseCount = getSuccessfulPurchaseCount;
module.exports.checkAndCreditRewards = checkAndCreditRewards;