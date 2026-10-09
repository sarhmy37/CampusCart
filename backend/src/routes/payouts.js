const express = require('express');
const pool = require('../db/pool');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { createTransferRecipient, initiateTransfer, resolvePayoutName, toPaystackBankCode } = require('../utils/paystack');

const router = express.Router();

// GET /api/payouts/banks — list available banks (from DB, with a full fallback list)
router.get('/banks', async (req, res) => {
    try {
        const banks = await pool.query('SELECT code, name, type FROM banks ORDER BY type, name');
        if (banks.rows.length === 0) throw new Error('banks table empty');
        res.json(banks.rows);
    } catch (err) {
        console.error('Get banks error:', err);
        res.status(500).json({ error: 'Could not load banks' });
    }
});

// GET /api/payouts/check-account — is this account already linked to another seller?
router.get('/check-account', optionalAuth, async (req, res) => {
    const { bank_code, account_number } = req.query;
    if (!bank_code || !account_number) return res.json({ taken: false });
    try {
        const result = await pool.query(
            'SELECT 1 FROM seller_payout_accounts WHERE account_number = $1 AND bank_code = $2 AND seller_id IS DISTINCT FROM $3 LIMIT 1',
            [account_number, bank_code, req.userId || null]
        );
        res.json({ taken: result.rows.length > 0 });
    } catch (err) {
        console.error('Check payout account error:', err);
        res.json({ taken: false });
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

    if (!bank_code || !account_number) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (String(account_number).length < 9) {
        return res.status(400).json({ error: 'Account number must be at least 9 digits' });
    }

    let verifiedName;
    try {
        verifiedName = await resolvePayoutName(bank_code, String(account_number));
    } catch (err) {
        console.error('[ADD ACCOUNT RESOLVE FAIL]', { bank_code, len: String(account_number).length, status: err?.status }, err?.message);
        return res.status(400).json({ error: "We couldn't verify this payout account. Check the number and network/bank." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Block a number/account already linked to another seller
        const payoutClash = await client.query(
            'SELECT 1 FROM seller_payout_accounts WHERE account_number = $1 AND bank_code = $2 AND seller_id != $3 LIMIT 1',
            [account_number, bank_code, req.userId]
        );
        if (payoutClash.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'This payout account is already linked to another seller' });
        }

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
            [req.userId, bank_code, bankName, account_number, verifiedName, method || 'bank', isFirst]
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
            await client.query('ROLLBACK');
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

// DELETE /api/payouts/accounts/:accountId — permanently remove a payout account
router.delete('/accounts/:accountId', requireAuth, async (req, res) => {
    const { accountId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const accountCheck = await client.query(
            'SELECT id, is_default FROM seller_payout_accounts WHERE id = $1 AND seller_id = $2',
            [accountId, req.userId]
        );
        const account = accountCheck.rows[0];
        if (!account) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Payout account not found' });
        }

        await client.query('DELETE FROM seller_payout_accounts WHERE id = $1', [accountId]);

        // If the deleted account was the default, promote the next most recent
        // remaining account (if any) to default so withdrawals aren't left
        // without a default selected.
        if (account.is_default) {
            await client.query(
                `UPDATE seller_payout_accounts SET is_default = true
                 WHERE id = (
                     SELECT id FROM seller_payout_accounts
                     WHERE seller_id = $1
                     ORDER BY created_at DESC
                     LIMIT 1
                 )`,
                [req.userId]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Payout account deleted' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete payout account error:', err);
        res.status(500).json({ error: 'Failed to delete payout account' });
    } finally {
        client.release();
    }
});

// Shared helper: available balance = confirmed earnings minus everything already withdrawn.
// This replaces the old "mark every unpaid item as paid" approach, which couldn't
// support partial withdrawals and was wiping the whole balance on any withdraw.
async function getAvailableBalance(sellerId, db = pool) {
    const earnedResult = await db.query(
        `SELECT COALESCE(SUM(oi.seller_earnings), 0) AS total_earned
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.seller_id = $1
           AND o.status IN ('paid', 'completed')
           AND oi.buyer_confirmed_at IS NOT NULL`,
        [sellerId]
    );
    const withdrawnResult = await db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_withdrawn
         FROM payout_withdrawals
         WHERE seller_id = $1 AND status NOT IN ('failed', 'reversed')`,
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
// Check Paystack's current minimum and transfer fee for Ghana before launch,
// and decide whether the seller or the platform pays the fee.
const MIN_WITHDRAWAL_GHS = 1;

router.post('/withdraw', requireAuth, async (req, res) => {
    const { accountId, password } = req.body;
    const amountGHS = Math.round(Number(req.body.amountGHS) * 100) / 100;

    if (!accountId || !Number.isFinite(amountGHS) || amountGHS <= 0) {
        return res.status(400).json({ error: 'Invalid request' });
    }
    if (amountGHS < MIN_WITHDRAWAL_GHS) {
        return res.status(400).json({ error: `Minimum withdrawal is GHS ${MIN_WITHDRAWAL_GHS.toFixed(2)}` });
    }
    if (!password) {
        return res.status(400).json({ error: 'Password is required to confirm withdrawal' });
    }

    let withdrawal;
    let account;

    // Step 1: validate and reserve the money inside a transaction.
    const client = await pool.connect();
    try {
        const userResult = await client.query('SELECT verified, password_hash FROM users WHERE id = $1', [req.userId]);
        const currentUser = userResult.rows[0];
        if (!currentUser?.verified) {
            return res.status(403).json({ error: 'You must verify your account before withdrawing funds' });
        }

        const bcrypt = require('bcryptjs');
        const passwordMatch = await bcrypt.compare(password, currentUser.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const accResult = await client.query(
            'SELECT * FROM seller_payout_accounts WHERE id = $1 AND seller_id = $2',
            [accountId, req.userId]
        );
        account = accResult.rows[0];
        if (!account) {
            return res.status(404).json({ error: 'Payout account not found' });
        }

        await client.query('BEGIN');
        // Lock this seller's row so two simultaneous requests can't both pass the balance check
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.userId]);

        const availableBalance = await getAvailableBalance(req.userId, client);
        if (amountGHS > availableBalance) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        const ins = await client.query(
            `INSERT INTO payout_withdrawals (seller_id, account_id, amount, status)
             VALUES ($1, $2, $3, 'pending') RETURNING id`,
            [req.userId, accountId, amountGHS]
        );
        const reference = `wd_${ins.rows[0].id}`;
        const upd = await client.query(
            `UPDATE payout_withdrawals SET transfer_reference = $1, updated_at = now() WHERE id = $2 RETURNING *`,
            [reference, ins.rows[0].id]
        );
        withdrawal = upd.rows[0];
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Withdraw reserve error:', err);
        return res.status(500).json({ error: 'Failed to process withdrawal' });
    } finally {
        client.release();
    }

    // Step 2: send the money through Paystack.
    try {
        let recipientCode = account.paystack_recipient_code;
        if (!recipientCode) {
            const isMomo = account.method === 'mobile_money';
            const r = await createTransferRecipient({
                type: isMomo ? 'mobile_money' : 'ghipss',
                name: account.account_name,
                account_number: account.account_number,
                bank_code: toPaystackBankCode(account.bank_code),
            });
            recipientCode = r.data.recipient_code;
            await pool.query(
                'UPDATE seller_payout_accounts SET paystack_recipient_code = $1 WHERE id = $2',
                [recipientCode, account.id]
            );
        }

        const t = await initiateTransfer({
            recipient_code: recipientCode,
            amountGHS,
            reason: 'Tre-X seller payout',
            reference: withdrawal.transfer_reference,
        });

        if (t.data?.status === 'otp') {
            console.error('[WITHDRAW] Paystack is asking for an OTP. Turn OTP off for transfers in the Paystack dashboard (Preferences).', withdrawal.id);
        }

        // Only move pending -> processing. If the webhook already set a final status, leave it alone.
        await pool.query(
            `UPDATE payout_withdrawals
             SET status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END,
                 transfer_code = $1, updated_at = now()
             WHERE id = $2`,
            [t.data?.transfer_code || null, withdrawal.id]
        );

        console.log(`[WITHDRAW] Seller ${req.userId} GHS ${amountGHS} sent to Paystack, ref ${withdrawal.transfer_reference}`);
        return res.json({
            success: true,
            message: `Withdrawal of GHS ${amountGHS.toFixed(2)} initiated successfully!`,
        });
    } catch (err) {
        const status = err?.status;
        console.error('[WITHDRAW FAIL]', { withdrawalId: withdrawal.id, status }, err?.message);

        if (status && status >= 400 && status < 500) {
            // Paystack clearly rejected it (bad recipient, low platform balance, etc.). Release the money.
            await pool.query(
                `UPDATE payout_withdrawals SET status = 'failed', failure_reason = $1, updated_at = now()
                 WHERE id = $2 AND status IN ('pending', 'processing')`,
                [String(err.message).slice(0, 300), withdrawal.id]
            );
            return res.status(400).json({ error: "We couldn't send this withdrawal right now. Your balance was not charged. Please try again later or contact support." });
        }

        // Network error or Paystack 5xx: we don't know if it went through. Keep it reserved
        // as processing and let the webhook (or a manual check) settle it.
        return res.status(202).json({
            success: true,
            message: 'Your withdrawal is being processed. We will update its status shortly.',
        });
    }
});

// GET /api/payouts/withdrawals — full withdrawal history for the seller
router.get('/withdrawals', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT w.id, w.amount, w.status, w.created_at, w.reported_at, w.report_message,
                    a.account_name, a.bank_name, a.account_number
             FROM payout_withdrawals w
             LEFT JOIN seller_payout_accounts a ON a.id = w.account_id
             WHERE w.seller_id = $1
             ORDER BY w.created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get withdrawals error:', err);
        res.status(500).json({ error: 'Failed to fetch withdrawal history' });
    }
});

// POST /api/payouts/withdrawals/:id/report — seller reports a completed withdrawal as not received
router.post('/withdrawals/:id/report', requireAuth, async (req, res) => {
    const { message } = req.body;
    try {
        const result = await pool.query(
            `UPDATE payout_withdrawals SET reported_at = now(), report_message = $1
             WHERE id = $2 AND seller_id = $3 AND status = 'completed'
             RETURNING *`,
            [message || null, req.params.id, req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Withdrawal not found or not eligible for reporting' });
        }
        res.json({ success: true, message: 'Report submitted. Our team will look into it.' });
    } catch (err) {
        console.error('Report withdrawal error:', err);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

router.post('/resolve-account', requireAuth, async (req, res) => {
    const { bank_code, account_number } = req.body;
    if (!bank_code || !account_number) return res.status(400).json({ error: 'Missing details' });
    try {
        const account_name = await resolvePayoutName(bank_code, String(account_number));
        res.json({ account_name });
    } catch (err) {
        console.error('[RESOLVE FAIL]', { bank_code, len: String(account_number).length, status: err?.status }, err?.message);
        res.status(404).json({ error: "Couldn't find an account with these details" });
    }
});

module.exports = router;