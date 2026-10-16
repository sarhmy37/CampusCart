const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction, paystackRequest } = require('../utils/paystack');
const { insertNotification } = require('../utils/notifications');
const { isPlanActive } = require('../utils/plans');

const router = express.Router();

// ─── POST /api/bookings ──────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
    const { service_id, service_option_name, booking_date, booking_time, message } = req.body;
    const buyer_id = req.userId;

    if (!service_id || !booking_date || !booking_time) {
        return res.status(400).json({ error: 'Service ID, date, and time are required.' });
    }

    try {
        // 1. Fetch the service details
        const serviceResult = await pool.query(
            `SELECT id, title, seller_id, price, service_options, service_duration,
                    u.plan AS seller_plan, u.plan_expires_at
             FROM products p JOIN users u ON u.id = p.seller_id
             WHERE p.id = $1`,
            [service_id]
        );
        const service = serviceResult.rows[0];
        if (!service) return res.status(404).json({ error: 'Service not found' });

        // 2. Check if the buyer is the seller
        if (service.seller_id === buyer_id) {
            return res.status(400).json({ error: 'You cannot book your own service.' });
        }

        let serviceOptions = [];
        try {
            serviceOptions = Array.isArray(service.service_options)
                ? service.service_options
                : JSON.parse(service.service_options || '[]');
        } catch {
            serviceOptions = [];
        }
        if (serviceOptions.length === 0 && Number(service.price) > 0) {
            serviceOptions = [{ name: 'Service', price: Number(service.price) }];
        }
        const selectedOption = serviceOptions.find((option) => option.name === service_option_name);
        if (!selectedOption) {
            return res.status(400).json({ error: 'Select one of the available service options.' });
        }
        const serviceAmount = Math.round(Number(selectedOption.price) * 100) / 100;
        const buyerFee = Math.round(serviceAmount * 0.02 * 100) / 100;
        const sellerFee = isPlanActive(service.seller_plan, service.seller_plan_expires_at)
            ? 0
            : Math.round(serviceAmount * 0.02 * 100) / 100;
        const sellerEarnings = Math.round((serviceAmount - sellerFee) * 100) / 100;

        // 3. Check for overlapping bookings — duration-aware, not just exact-time match.
        // The seller sets how long one booking takes (duration_minutes, stored in the
        // same service_duration JSON as the working-hours schedule). Two bookings for
        // the same service conflict if their [start, start+duration) ranges overlap.
        // A 'confirmed' booking always blocks its range. A 'pending_payment' booking
        // only blocks it while fresh (checkout in progress, <15 min old).
        let durationMinutes = 60; // default for legacy/unset services
        try {
            const schedule = service.service_duration ? JSON.parse(service.service_duration) : null;
            if (schedule && Number(schedule.duration_minutes) > 0) {
                durationMinutes = Number(schedule.duration_minutes);
            }
        } catch {
            // legacy plain-text duration value — fall back to default
        }
        if (Number(selectedOption.duration_minutes) > 0) {
            durationMinutes = Number(selectedOption.duration_minutes);
        }

        const timeToMinutes = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };
        const minutesToTime = (mins) => {
            const wrapped = ((mins % 1440) + 1440) % 1440;
            const h = String(Math.floor(wrapped / 60)).padStart(2, '0');
            const m = String(wrapped % 60).padStart(2, '0');
            return `${h}:${m}`;
        };

        const sameDayBookings = await pool.query(
            `SELECT booking_time, duration_minutes FROM bookings
             WHERE service_id = $1
               AND booking_date = $2
               AND (
                   status = 'confirmed'
                   OR (status = 'pending_payment' AND created_at > NOW() - INTERVAL '15 minutes')
               )`,
            [service_id, booking_date]
        );

        const requestedStart = timeToMinutes(booking_time);
        const requestedEnd = requestedStart + durationMinutes;

        let conflictEnd = null;
        for (const row of sameDayBookings.rows) {
            const existingStart = timeToMinutes(row.booking_time);
            const existingEnd = existingStart + (Number(row.duration_minutes) || durationMinutes);
            if (requestedStart < existingEnd && existingStart < requestedEnd) {
                if (conflictEnd === null || existingEnd > conflictEnd) conflictEnd = existingEnd;
            }
        }

        if (conflictEnd !== null) {
            return res.status(409).json({
                error: `This provider is booked until ${minutesToTime(conflictEnd)}. Try adjusting your time to after that.`,
                next_available_time: minutesToTime(conflictEnd),
            });
        }

        // 4. Insert booking with pending_payment status
        const platformFee = buyerFee;
        const reference = `book_${Date.now()}_${buyer_id}`;

        const bookingResult = await pool.query(
            `INSERT INTO bookings
                (service_id, buyer_id, seller_id, booking_date, booking_time, message, service_option_name,
                 service_amount, buyer_fee, seller_fee, seller_earnings, platform_fee, payment_reference, duration_minutes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending_payment')
             RETURNING id`,
            [service_id, buyer_id, service.seller_id, booking_date, booking_time, message || '', selectedOption.name,
             serviceAmount, buyerFee, sellerFee, sellerEarnings, platformFee, reference, durationMinutes]
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
            amountGHS: serviceAmount + buyerFee,
            reference,
            callback_url: `${process.env.PUBLIC_API_URL || 'https://campuscart-tdfn.onrender.com'}/paystack/callback`,
            metadata: { booking_id: bookingId, buyer_id, service_id },
        });

        // 7. Return the payment link to frontend
        res.status(201).json({
            booking_id: bookingId,
            service_title: service.title,
            service_option_name: selectedOption.name,
            service_amount: serviceAmount,
            buyer_fee: buyerFee,
            total_amount: serviceAmount + buyerFee,
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

        const expectedAmount = Math.round((parseFloat(booking.service_amount) + parseFloat(booking.buyer_fee)) * 100) / 100;
        if (Math.abs(amountPaidGHS - expectedAmount) > 0.05) {
            console.error(`[BOOKING AMOUNT MISMATCH] Booking ${booking.id}: expected GHS ${expectedAmount}, got GHS ${amountPaidGHS}`);
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
            `/dashboard?tab=orders`
        );

        // Notify buyer
        await insertNotification(
            booking.buyer_id,
            'booking_confirmed',
            `Your booking for "${serviceTitle}" is confirmed! Date: ${booking.booking_date}, Time: ${booking.booking_time}.`,
            booking.id,
            `/dashboard?tab=orders`
        );

    } catch (err) {
        console.error('Booking webhook processing error:', err);
    }
}

// POST /api/bookings/:id/verify — direct Paystack verification after checkout.
router.post('/:id/verify', requireAuth, async (req, res) => {
    try {
        const bookingResult = await pool.query(
            `SELECT id, buyer_id, payment_reference, status
             FROM bookings
             WHERE id = $1 AND buyer_id = $2`,
            [req.params.id, req.userId]
        );
        const booking = bookingResult.rows[0];
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (req.body.reference && req.body.reference !== booking.payment_reference) {
            return res.status(400).json({ error: 'Invalid booking payment reference' });
        }
        if (booking.status === 'confirmed' || booking.status === 'completed') {
            return res.json({ status: booking.status });
        }

        const payment = await paystackRequest(
            `/transaction/verify/${encodeURIComponent(booking.payment_reference)}`
        );
        if (payment.data.status !== 'success') {
            return res.status(400).json({ error: 'Booking payment was not successful', status: payment.data.status });
        }

        await processBookingWebhookEvent({
            event: 'charge.success',
            data: {
                reference: booking.payment_reference,
                amount: payment.data.amount,
            },
        });
        res.json({ status: 'confirmed' });
    } catch (err) {
        console.error('Direct booking verification error:', err);
        res.status(500).json({ error: 'Could not verify booking payment' });
    }
});

// GET /api/bookings/buyer – bookings the logged-in user has made
router.get('/buyer', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.*, p.title as service_title, u.name as seller_name,
                    COALESCE(u.personal_email, u.university_email) as seller_email
             FROM bookings b
             JOIN products p ON p.id = b.service_id
             JOIN users u ON u.id = b.seller_id
             WHERE b.buyer_id = $1 AND b.status IN ('pending_payment', 'confirmed', 'completed')
             ORDER BY b.created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch buyer bookings error:', err);
        res.status(500).json({ error: 'Failed to fetch your bookings' });
    }
});

// GET /api/bookings/seller – bookings for the logged-in seller
router.get('/seller', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.*, p.title as service_title, u.name as buyer_name,
                    COALESCE(u.personal_email, u.university_email) as buyer_email
             FROM bookings b
             JOIN products p ON p.id = b.service_id
             JOIN users u ON u.id = b.buyer_id
             WHERE b.seller_id = $1 AND b.status IN ('pending_payment', 'confirmed', 'completed')
             ORDER BY b.created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch seller bookings error:', err);
        res.status(500).json({ error: 'Failed to fetch service bookings' });
    }
});

// PATCH /api/bookings/:id/confirm – seller marks the booking as completed
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
            `Your booking for "${booking.service_title}" on ${booking.booking_date} at ${booking.booking_time} has been marked as completed by the seller. You can now leave a review.`,
            booking.id,
            `/dashboard?tab=orders`
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