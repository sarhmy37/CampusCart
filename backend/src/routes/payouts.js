const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

async function paystackRequest(pathname, options = {}) {
    const res = await fetch(`${PAYSTACK_BASE}${pathname}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    const data = await res.json();
    if (!res.ok || data.status === false) {
        throw new Error(data.message || 'Paystack request failed');
    }
    return data;
}

// GET /api/payouts/banks
// Returns Ghana banks + mobile money networks in one list (Paystack tags each with `type`)
router.get('/banks', requireAuth, async (req, res) => {
    try {
        const data = await paystackRequest('/bank?country=ghana&currency=GHS');
        const banks = data.data
            .filter((b) => b.active)
            .map((b) => ({ code: b.code, name: b.name, type: b.type }));
        res.json(banks);
    } catch (err) {
        console.error('Fetch banks error:', err.message);
        res.status(500).json({ error: 'Could not load bank list right now' });
    }
});

// POST /api/payouts/resolve-account
// Body: { bank_code, account_number }
router.post('/resolve-account', requireAuth, async (req, res) => {
    const { bank_code, account_number } = req.body;
    if (!bank_code || !account_number) {
        return res.status(400).json({ error: 'bank_code and account_number are required' });
    }

    try {
        const data = await paystackRequest(
            `/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(bank_code)}`
        );
        res.json({ account_name: data.data.account_name });
    } catch (err) {
        console.error('Resolve account error:', err.message);
        res.status(400).json({ error: "Couldn't verify that account. Double-check the number and try again." });
    }
});

// GET /api/payouts/me
router.get('/me', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT method, bank_code, bank_name, account_number, account_name FROM seller_payout_accounts WHERE seller_id = $1',
            [req.userId]
        );
        if (result.rows.length === 0) {
            return res.json(null);
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get payout account error:', err);
        res.status(500).json({ error: 'Something went wrong loading your payout account' });
    }
});

// POST /api/payouts/me
// Body: { method, bank_code, account_number, account_name }
router.post('/me', requireAuth, async (req, res) => {
    const { method, bank_code, account_number, account_name } = req.body;

    if (!method || !bank_code || !account_number || !account_name) {
        return res.status(400).json({ error: 'method, bank_code, account_number, and account_name are required' });
    }
    if (!['bank', 'mobile_money'].includes(method)) {
        return res.status(400).json({ error: 'Invalid payout method' });
    }

    try {
        const banksData = await paystackRequest('/bank?country=ghana&currency=GHS');
        const matchedBank = banksData.data.find((b) => b.code === bank_code);
        if (!matchedBank) {
            return res.status(400).json({ error: 'Unrecognized bank/network code' });
        }

        const result = await pool.query(
            `INSERT INTO seller_payout_accounts (seller_id, method, bank_code, bank_name, account_number, account_name)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (seller_id) DO UPDATE SET
                method = EXCLUDED.method,
                bank_code = EXCLUDED.bank_code,
                bank_name = EXCLUDED.bank_name,
                account_number = EXCLUDED.account_number,
                account_name = EXCLUDED.account_name,
                updated_at = now()
             RETURNING method, bank_code, bank_name, account_number, account_name`,
            [req.userId, method, bank_code, matchedBank.name, account_number, account_name]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Save payout account error:', err);
        res.status(500).json({ error: 'Something went wrong saving your payout account' });
    }
});

module.exports = router;