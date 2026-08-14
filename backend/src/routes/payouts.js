const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { createTransferRecipient, initiateTransfer } = require('../utils/paystack');

const router = express.Router();

// GET /api/payouts/banks — list available banks from Paystack (already exists)
router.get('/banks', async (req, res) => {
    try {
        const banks = await pool.query('SELECT code, name, type FROM banks');
        res.json(banks.rows);
    } catch {
        // Fallback: return a default list if the table doesn't exist
        res.json([
            { code: '058', name: 'GT Bank', type: 'bank' },
            { code: '065', name: 'MTN Mobile Money', type: 'mobile_money' },
            // ... add more as needed
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

        const result = await client.query(
            `INSERT INTO seller_payout_accounts (seller_id, bank_code, account_number, account_name, method, is_default)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.userId, bank_code, account_number, account_name, method || 'bank', isFirst]
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

module.exports = router;