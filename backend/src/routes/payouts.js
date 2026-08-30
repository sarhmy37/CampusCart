const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { createTransferRecipient, initiateTransfer } = require('../utils/paystack');

const router = express.Router();

// GET /api/payouts/banks — list available banks (from DB, with a full fallback list)
router.get('/banks', async (req, res) => {
    try {
        const banks = await pool.query('SELECT code, name, type FROM banks');
        if (banks.rows.length === 0) throw new Error('banks table empty');
        res.json(banks.rows);
    } catch {
        // Fallback: full default list, used if the table doesn't exist or is empty
        res.json([
            { code: '001', name: 'GCB', type: 'bank' },
            { code: '002', name: 'Stanbic', type: 'bank' },
            { code: '003', name: 'Ecobank', type: 'bank' },
            { code: '004', name: 'ABSA', type: 'bank' },
            { code: '005', name: 'Access Bank', type: 'bank' },
            { code: '006', name: 'UBA', type: 'bank' },
            { code: '007', name: 'Fidelity', type: 'bank' },
            { code: '008', name: 'First National', type: 'bank' },
            { code: '009', name: 'Republic Bank', type: 'bank' },
            { code: '010', name: 'CalBank', type: 'bank' },
            { code: '011', name: 'Prudential Bank', type: 'bank' },
            { code: '012', name: 'GT Bank', type: 'bank' },
            { code: '013', name: 'Bank of Africa', type: 'bank' },
            { code: '014', name: 'First Atlantic', type: 'bank' },
            { code: '015', name: 'Zenith Bank', type: 'bank' },
            { code: '016', name: 'FBN Bank', type: 'bank' },
            { code: '017', name: 'Societe Generale', type: 'bank' },
            { code: '018', name: 'UMB', type: 'bank' },
            { code: '019', name: 'NIB', type: 'bank' },
            { code: '020', name: 'ADB', type: 'bank' },
            { code: '021', name: 'OmniBSIC', type: 'bank' },
            { code: 'MTN', name: 'MTN Mobile Money', type: 'mobile_money' },
            { code: 'VOD', name: 'Vodafone Cash', type: 'mobile_money' },
            { code: 'AT', name: 'AirtelTigo Money', type: 'mobile_money' },
        ]);
    }
});

// POST /api/payouts/resolve-account — resolve account name (already exists)
router.post('/resolve-account', requireAuth, async (req, res) => {
    const { bank_code, account_number } = req.body;
    try {
        // This should call Paystack's resolve endpoint.
        // For now, return a dummy name.
        res.json({ account_name: 'SAMPLE NAME' });
    } catch {
        res.status(400).json({ error: 'Could not resolve account' });
    }
});

// GET /api/payouts/accounts — get all payout accounts for the logged-in seller
router.get('/accounts', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, bank_code, account_number, account_name, method, is_default,
                    (SELECT name FROM banks WHERE code = seller_payout_accounts.bank_code) AS bank_name
             FROM seller_payout_accounts
             WHERE seller_id = $1
             ORDER BY is_default DESC, created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get payout accounts error:', err);
        res.status(500).json({ error: 'Failed to fetch payout accounts' });
    }
});

// POST /api/payouts/accounts — add a new payout account
router.post('/accounts', requireAuth, async (req, res) => {
    const { bank_code, account_number, account_name, method } = req.body;

    if (!bank_code || !account_number || !account_name) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (account_number.length < 9) {
        return res.status(400).json({ error: 'Account number must be at least 9 digits' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if this is the seller's first account
        const countResult = await client.query(
            'SELECT COUNT(*) FROM seller_payout_accounts WHERE seller_id = $1',
            [req.userId]
        );
        const isFirst = parseInt(countResult.rows[0].count, 10) === 0;

                const bankResult = await client.query('SELECT name FROM banks WHERE code = $1', [bank_code]);
        const bankName = bankResult.rows[0]?.name || null;

        const result = await client.query(
            `INSERT INTO seller_payout_accounts (seller_id, bank_code, bank_name, account_number, account_name, method, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [req.userId, bank_code, bankName, account_number, account_name, method || 'bank', isFirst]
        );

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Add payout account error:', err);
        res.status(500).json({ error: 'Failed to add payout account' });
    } finally {
        client.release();
    }
});

// PATCH /api/payouts/default/:accountId — set default account
router.patch('/default/:accountId', requireAuth, async (req, res) => {
    const { accountId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify the account belongs to this seller
        const accountCheck = await client.query(
            'SELECT id FROM seller_payout_accounts WHERE id = $1 AND seller_id = $2',
            [accountId, req.userId]
        );
        if (accountCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        // Set all accounts to non-default
        await client.query(
            'UPDATE seller_payout_accounts SET is_default = false WHERE seller_id = $1',
            [req.userId]
        );

        // Set the selected account as default
        await client.query(
            'UPDATE seller_payout_accounts SET is_default = true WHERE id = $1',
            [accountId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Default account updated' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Set default account error:', err);
        res.status(500).json({ error: 'Failed to update default account' });
    } finally {
        client.release();
    }
});

// Shared helper: available balance = confirmed earnings minus everything already withdrawn.
// This replaces the old "mark every unpaid item as paid" approach, which couldn't
// support partial withdrawals and was wiping the whole balance on any withdraw.
async function getAvailableBalance(sellerId) {
    const earnedResult = await pool.query(
        `SELECT COALESCE(SUM(oi.seller_earnings), 0) AS total_earned
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.seller_id = $1
           AND o.status = 'paid'
           AND oi.buyer_confirmed_at IS NOT NULL`,
        [sellerId]
    );
    const withdrawnResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_withdrawn
         FROM payout_withdrawals
         WHERE seller_id = $1`,
        [sellerId]
    );

    const totalEarned = parseFloat(earnedResult.rows[0].total_earned);
    const totalWithdrawn = parseFloat(withdrawnResult.rows[0].total_withdrawn);
    return Math.round((totalEarned - totalWithdrawn) * 100) / 100;
}

// GET /api/payouts/balance
router.get('/balance', requireAuth, async (req, res) => {
    try {
        const balance = await getAvailableBalance(req.userId);
        res.json({ availableBalance: balance });
    } catch (err) {
        console.error('Get balance error:', err);
        res.status(500).json({ error: 'Could not fetch balance' });
    }
});

// POST /api/payouts/withdraw — withdraws a specific amount, logged as a ledger entry
// rather than flagging order items as paid. This is what actually fixes the bug
// where withdrawing part of your balance wiped out the whole thing.
router.post('/withdraw', requireAuth, async (req, res) => {
    const { accountId, amountGHS, password } = req.body;

    if (!accountId || !amountGHS || amountGHS <= 0) {
        return res.status(400).json({ error: 'Invalid request' });
    }
    if (!password) {
        return res.status(400).json({ error: 'Password is required to confirm withdrawal' });
    }

    try {
        const userResult = await pool.query('SELECT verified, password_hash FROM users WHERE id = $1', [req.userId]);
        const currentUser = userResult.rows[0];
        if (!currentUser?.verified) {
            return res.status(403).json({ error: 'You must verify your account before withdrawing funds' });
        }

        const bcrypt = require('bcryptjs');
        const passwordMatch = await bcrypt.compare(password, currentUser.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const accResult = await pool.query(
            `SELECT * FROM seller_payout_accounts WHERE id = $1 AND seller_id = $2`,
            [accountId, req.userId]
        );
        const account = accResult.rows[0];
        if (!account) {
            return res.status(404).json({ error: 'Payout account not found' });
        }

        const availableBalance = await getAvailableBalance(req.userId);
        if (amountGHS > availableBalance) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        let recipientCode = account.paystack_recipient_code;
        if (!recipientCode) {
            console.log(`[WITHDRAWAL SETUP] Recipient for ${account.account_name} needs to be created.`);
        }

        console.log(`[WITHDRAW] Seller ${req.userId} requested GHS ${amountGHS} to account ${accountId}`);

        // Log this withdrawal as its own ledger entry — balance is recalculated
        // from earnings-minus-withdrawals, so this is the only write needed.
        await pool.query(
            `INSERT INTO payout_withdrawals (seller_id, account_id, amount, status)
             VALUES ($1, $2, $3, 'processing')`,
            [req.userId, accountId, amountGHS]
        );

        res.json({
            success: true,
            message: `Withdrawal of GHS ${amountGHS.toFixed(2)} initiated successfully!`
        });

    } catch (err) {
        console.error('Withdraw error:', err);
        res.status(500).json({ error: 'Failed to process withdrawal' });
    }
});

module.exports = router;