const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction } = require('../utils/paystack');
const { insertNotification } = require('../utils/notifications');

const router = express.Router();

// ─── POST /api/bookings ──────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
    const { service_id, booking_date, booking_time, message } = req.body;
    const buyer_id = req.userId;

    if (!service_id || !booking_date || !booking_time) {
        return res.status(400).json({ error: 'Service ID, date, and time are required.' });
    }

    try {
        // 1. Fetch the service details
        const serviceResult = await pool.query(
            `SELECT id, title, seller_id, price FROM products WHERE id = $1`,
            [service_id]
        );
        const service = serviceResult.rows[0];
        if (!service) return res.status(404).json({ error: 'Service not found' });

        // 2. Check if the buyer is the seller
        if (service.seller_id === buyer_id) {
            return res.status(400).json({ error: 'You cannot book your own service.' });
        }

        // 3. Check for double booking (optional)
        const existing = await pool.query(
            `SELECT id FROM bookings WHERE service_id = $1 AND status IN ('pending_payment', 'confirmed')`,
            [service_id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'This service is currently booked or pending. Please try another time.' });
        }

        // 4. Insert booking with pending_payment status
        const platformFee = 2.00; // GHS 2.00
        const reference = `book_${Date.now()}_${buyer_id}`;

        const bookingResult = await pool.query(
            `INSERT INTO bookings
                (service_id, buyer_id, seller_id, booking_date, booking_time, message, platform_fee, payment_reference, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_payment')
             RETURNING id`,
            [service_id, buyer_id, service.seller_id, booking_date, booking_time, message || '', platformFee, reference]
        );
        const bookingId = bookingResult.rows[0].id;

        // 5. Get buyer email
        const userResult = await pool.query(
            `SELECT personal_email, university_email FROM users WHERE id = $1`,
            [buyer_id]
        );
        const buyerEmail = userResult.rows[0]?.personal_email || userResult.rows[0]?.university_email;
        if (!buyerEmail) {
            // Fallback: if no email, we can't proceed with Paystack
            await pool.query(`DELETE FROM bookings WHERE id = $1`, [bookingId]);
            return res.status(400).json({ error: 'No email found for user. Please update your profile.' });
        }

        // 6. Initialize Paystack transaction
        const paystackRes = await initializeTransaction({
            email: buyerEmail,
            amountGHS: platformFee,
            reference,
            callback_url: `${process.env.CORS_ORIGIN}/browse`, // redirect after payment
            metadata: { booking_id: bookingId, buyer_id, service_id },
        });

        // 7. Return the payment link to frontend
        res.status(201).json({
            booking_id: bookingId,
            service_title: service.title,
            platform_fee: platformFee,
            authorization_url: paystackRes.data.authorization_url,
        });

    } catch (err) {
        console.error('Create booking error:', err);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ─── Webhook processor (to be called from orders webhook) ─────────────
async function processBookingWebhookEvent(event) {
    const reference = event.data.reference;
    const amountPaidGHS = Math.round((event.data.amount / 100) * 100) / 100;

    try {
        const bookingResult = await pool.query(
            `SELECT * FROM bookings WHERE payment_reference = $1 AND status = 'pending_payment'`,
            [reference]
        );
        const booking = bookingResult.rows[0];
        if (!booking) return; // Already processed or not found

        const expectedFee = parseFloat(booking.platform_fee);
        if (Math.abs(amountPaidGHS - expectedFee) > 0.05) {
            console.error(`[BOOKING AMOUNT MISMATCH] Booking ${booking.id}: expected GHS ${expectedFee}, got GHS ${amountPaidGHS}`);
            // Optionally notify admin
            return;
        }

        // Update booking status to confirmed
        await pool.query(
            `UPDATE bookings SET status = 'confirmed', paid_at = NOW() WHERE id = $1`,
            [booking.id]
        );

        // Send notifications
        const serviceResult = await pool.query(
            `SELECT title FROM products WHERE id = $1`,
            [booking.service_id]
        );
        const serviceTitle = serviceResult.rows[0]?.title || 'Service';

        // Notify seller
        await insertNotification(
            booking.seller_id,
            'booking_confirmed',
            `You have a new booking for "${serviceTitle}" on ${booking.booking_date} at ${booking.booking_time}. Please check the booking details.`,
            booking.id,
            `/bookings/${booking.id}`
        );

        // Notify buyer
        await insertNotification(
            booking.buyer_id,
            'booking_confirmed',
            `Your booking for "${serviceTitle}" is confirmed! Date: ${booking.booking_date}, Time: ${booking.booking_time}.`,
            booking.id,
            `/bookings/${booking.id}`
        );

    } catch (err) {
        console.error('Booking webhook processing error:', err);
    }
}

// GET /api/bookings/seller – bookings for the logged-in seller
router.get('/seller', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.*, p.title as service_title, u.name as buyer_name, u.email as buyer_email
             FROM bookings b
             JOIN products p ON p.id = b.service_id
             JOIN users u ON u.id = b.buyer_id
             WHERE b.seller_id = $1 AND b.status IN ('pending_payment', 'confirmed')
             ORDER BY b.created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch seller bookings error:', err);
        res.status(500).json({ error: 'Failed to fetch service bookings' });
    }
});

// PATCH /api/bookings/:id/confirm – seller confirms the booking as completed
router.patch('/:id/confirm', requireAuth, async (req, res) => {
    const { id } = req.params;
    const sellerId = req.userId;

    try {
        // Verify booking exists, belongs to this seller, and is in 'confirmed' status
        const bookingResult = await pool.query(
            `SELECT b.*, p.title as service_title
             FROM bookings b
             JOIN products p ON p.id = b.service_id
             WHERE b.id = $1 AND b.seller_id = $2 AND b.status = 'confirmed'`,
            [id, sellerId]
        );
        const booking = bookingResult.rows[0];
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found, already completed, or you are not the seller.' });
        }

        // Update status to 'completed'
        await pool.query(
            `UPDATE bookings SET status = 'completed', updated_at = NOW() WHERE id = $1`,
            [id]
        );

        // Notify the buyer that the booking is completed
        await insertNotification(
            booking.buyer_id,
            'booking_completed',
            `Your booking for "${booking.service_title}" on ${booking.booking_date} at ${booking.booking_time} has been confirmed by the seller. You can now arrange the service.`,
            booking.id,
            `/bookings/${booking.id}`
        );

        res.json({ success: true, message: 'Booking marked as completed.' });
    } catch (err) {
        console.error('Confirm booking error:', err);
        res.status(500).json({ error: 'Failed to confirm booking.' });
    }
});

// Expose the processor for the main webhook
module.exports = {
    router,
    processBookingWebhookEvent,
};