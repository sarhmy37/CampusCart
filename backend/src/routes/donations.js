const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const pool = require('../db/pool');
const { initializeTransaction, paystackRequest } = require('../utils/paystack');
const { insertNotification } = require('../utils/notifications');

const router = express.Router();
const MIN_DONATION_GHS = 5;

router.post('/initiate', requireAuth, async (req, res) => {
  const amountGHS = Number(req.body.amountGHS);
  if (!Number.isFinite(amountGHS) || amountGHS < MIN_DONATION_GHS) {
    return res.status(400).json({ error: `Donation must be at least GHS ${MIN_DONATION_GHS}` });
  }

  try {
    const { rows: [user] } = await pool.query(
      'SELECT university_email, personal_email FROM users WHERE id = $1',
      [req.userId]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const reference = `donation_${req.userId}_${crypto.randomBytes(6).toString('hex')}`;
    const payment = await initializeTransaction({
      email: user.personal_email || user.university_email,
      amountGHS: Math.round(amountGHS * 100) / 100,
      reference,
      metadata: { user_id: req.userId, type: 'trex_donation' },
      callback_url: `${process.env.CORS_ORIGIN}/donation/callback`,
      cancel_action: `${process.env.CORS_ORIGIN}/donation/callback?status=cancel`,
    });

    res.json({ authorization_url: payment.data.authorization_url, reference });
  } catch (err) {
    console.error('Donation initiate error:', err);
    res.status(500).json({ error: 'Could not start donation payment' });
  }
});

router.post('/verify', requireAuth, async (req, res) => {
  const reference = String(req.body.reference || '');
  if (!reference.startsWith(`donation_${req.userId}_`)) {
    return res.status(400).json({ error: 'Invalid donation reference' });
  }

  try {
    const payment = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    const data = payment.data;
    if (data.status !== 'success') return res.status(400).json({ error: 'Donation payment was not successful' });
    const message = 'We hope to make the platform a better place for all.';
    const title = 'Thank you for your support';
    const existing = await pool.query(
      `SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'donation_received' AND related_id = $2 LIMIT 1`,
      [req.userId, reference]
    );
    if (existing.rowCount === 0) {
      await insertNotification(req.userId, 'donation_received', message, reference, null, title, message);
    }
    res.json({ status: 'success', amountGHS: Number(data.amount) / 100 });
  } catch (err) {
    console.error('Donation verification error:', err);
    res.status(500).json({ error: 'Could not verify donation payment' });
  }
});

module.exports = router;
