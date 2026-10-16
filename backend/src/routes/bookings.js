const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { initializeTransaction, paystackRequest } = require('../utils/paystack');
const { insertNotification } = require('../utils/notifications');
const { getSellerFeeRate } = require('../utils/plans');
const { isSellerRestricted } = require('./sellers');

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
                    u.plan AS seller_plan, u.plan_expires_at, u.services_paused_until
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
        if (await isSellerRestricted(service.seller_id)) {
            return res.status(403).json({ error: 'This provider is currently unavailable.' });
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
        const buyerFee = 2;
        const sellerFee = Math.round(serviceAmount * 0.015 * 100) / 100;
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

        let startMin = timeToMinutes(booking_time);
        let queued = false;
        if (service.services_paused_until) {
            const p = new Date(service.services_paused_until);
            const pDate = p.toISOString().slice(0, 10);
            const bDate = String(booking_date).slice(0, 10);
            if (pDate > bDate) {
                return res.status(409).json({ error: 'This provider is unavailable on this day. Pick a later day.' });
            }
            if (pDate === bDate) {
                const pMin = p.getUTCHours() * 60 + p.getUTCMinutes();
                if (pMin > startMin) {
                    startMin = pMin;
                    queued = true;
                }
            }
        }
        let moved = true;
        while (moved) {
            moved = false;
            for (const row of sameDayBookings.rows) {
                const s = timeToMinutes(row.booking_time);
                const e = s + (Number(row.duration_minutes) || durationMinutes);
                if (startMin < e && s < startMin + durationMinutes) {
                    startMin = e;
                    queued = true;
                    moved = true;
                }
            }
        }
        if (startMin >= 1440) {
            return res.status(409).json({ error: 'This provider has no more free slots on this day. Pick another day.' });
        }
        const finalTime = minutesToTime(startMin);

        // 4. Insert booking with pending_payment status
        const platformFee = buyerFee;
        const reference = `book_${Date.now()}_${buyer_id}`;

        const bookingResult = await pool.query(
            `INSERT INTO bookings
                (service_id, buyer_id, seller_id, booking_date, booking_time, message, service_option_name,
                 service_amount, buyer_fee, seller_fee, seller_earnings, platform_fee, payment_reference, duration_minutes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending_payment')
             RETURNING id`,
            [service_id, buyer_id, service.seller_id, booking_date, finalTime, message || '', selectedOption.name,
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
            amountGHS: buyerFee,
            reference,
            callback_url: `${process.env.PUBLIC_API_URL || 'https://campuscart-tdfn.onrender.com'}/paystack/callback`,
            metadata: { booking_id: bookingId, buyer_id, service_id },
        });

        // 7. Return the payment link to frontend
        res.status(201).json({
            booking_id: bookingId,
            booking_time: finalTime,
            queued,
            service_title: service.title,
            service_option_name: selectedOption.name,
            service_amount: serviceAmount,
            buyer_fee: buyerFee,
            total_amount: buyerFee,
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

        const expectedAmount = Math.round(parseFloat(booking.buyer_fee) * 100) / 100;
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
             WHERE b.buyer_id = $1 AND b.status IN ('pending_payment', 'confirmed', 'completed', 'no_show')
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
             WHERE b.seller_id = $1 AND b.status IN ('pending_payment', 'confirmed', 'completed', 'no_show')
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

// PUT /api/bookings/pause — seller pauses until a time (send until: null to resume)
router.put('/pause', requireAuth, async (req, res) => {
    try {
        let value = null;
        if (req.body.until) {
            value = new Date(req.body.until);
            if (isNaN(value.getTime()) || value <= new Date()) {
                return res.status(400).json({ error: 'Pick a time in the future.' });
            }
        }
        await pool.query('UPDATE users SET services_paused_until = $1 WHERE id = $2', [value, req.userId]);
        res.json({ paused_until: value });
    } catch (err) {
        console.error('Pause error:', err);
        res.status(500).json({ error: 'Could not update availability.' });
    }
});

// GET /api/bookings/pause — current pause (null if not paused)
router.get('/pause', requireAuth, async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT CASE WHEN services_paused_until > NOW() THEN services_paused_until END AS paused_until
             FROM users WHERE id = $1`,
            [req.userId]
        );
        res.json({ paused_until: r.rows[0]?.paused_until || null });
    } catch (err) {
        res.status(500).json({ error: 'Could not load availability.' });
    }
});

// PATCH /api/bookings/:id/extend — seller adds time, later bookings shift and buyers are notified
router.patch('/:id/extend', requireAuth, async (req, res) => {
    const minutes = parseInt(req.body.minutes, 10);
    if (!(minutes > 0) || minutes > 480) {
        return res.status(400).json({ error: 'Choose between 1 and 480 minutes.' });
    }
    const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
    const toTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

    try {
        const r = await pool.query(
            `SELECT b.*, p.title AS service_title
             FROM bookings b JOIN products p ON p.id = b.service_id
             WHERE b.id = $1 AND b.seller_id = $2 AND b.status = 'confirmed'`,
            [req.params.id, req.userId]
        );
        const booking = r.rows[0];
        if (!booking) return res.status(404).json({ error: 'Booking not found.' });

        const newDuration = (Number(booking.duration_minutes) || 60) + minutes;
        await pool.query(
            `UPDATE bookings SET duration_minutes = $1, updated_at = NOW() WHERE id = $2`,
            [newDuration, booking.id]
        );

        const later = await pool.query(
            `SELECT id, buyer_id, booking_time, duration_minutes FROM bookings
             WHERE service_id = $1
               AND booking_date = (SELECT booking_date FROM bookings WHERE id = $2)
               AND status = 'confirmed'
               AND id <> $2
               AND booking_time > (SELECT booking_time FROM bookings WHERE id = $2)
             ORDER BY booking_time`,
            [booking.service_id, booking.id]
        );

        let cursor = toMin(booking.booking_time) + newDuration;
        for (const row of later.rows) {
            const dur = Number(row.duration_minutes) || 60;
            const s = toMin(row.booking_time);
            if (s < cursor) {
                if (cursor >= 1440) break;
                await pool.query(
                    `UPDATE bookings SET booking_time = $1, starting_notified = FALSE WHERE id = $2`,
                    [toTime(cursor), row.id]
                );
                await insertNotification(
                    row.buyer_id, 'booking_delayed',
                    `Your "${booking.service_title}" booking was delayed. New start time: ${toTime(cursor)}. Message the provider if you need to.`,
                    row.id, `/dashboard?tab=orders`
                );
                cursor = cursor + dur;
            } else {
                cursor = s + dur;
            }
        }

        res.json({ success: true, duration_minutes: newDuration });
    } catch (err) {
        console.error('Extend booking error:', err);
        res.status(500).json({ error: 'Could not extend this booking.' });
    }
});

// PATCH /api/bookings/:id/cancel — buyer cancels before the start time (free, booking fee not refunded)
router.patch('/:id/cancel', requireAuth, async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT b.id, b.seller_id, b.booking_time, p.title AS service_title
             FROM bookings b JOIN products p ON p.id = b.service_id
             WHERE b.id = $1 AND b.buyer_id = $2 AND b.status = 'confirmed'
               AND (b.booking_date + b.booking_time::time) > NOW()`,
            [req.params.id, req.userId]
        );
        const b = r.rows[0];
        if (!b) return res.status(404).json({ error: 'This booking can no longer be cancelled.' });

        await pool.query(`UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [b.id]);
        await insertNotification(
            b.seller_id, 'booking_cancelled',
            `A buyer cancelled their "${b.service_title}" booking for ${String(b.booking_time).slice(0, 5)}.`,
            b.id, `/dashboard?tab=orders`
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Cancel booking error:', err);
        res.status(500).json({ error: 'Could not cancel this booking.' });
    }
});

// PATCH /api/bookings/:id/reschedule — buyer moves the booking (free). Queues if the provider is busy.
router.patch('/:id/reschedule', requireAuth, async (req, res) => {
    const { booking_date, booking_time } = req.body;
    if (!booking_date || !booking_time) return res.status(400).json({ error: 'Date and time are required.' });
    if (new Date(`${booking_date}T${booking_time}:00Z`) <= new Date()) {
        return res.status(400).json({ error: 'Pick a time in the future.' });
    }
    const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
    const toTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

    try {
        const r = await pool.query(
            `SELECT b.*, p.title AS service_title, u.services_paused_until
             FROM bookings b
             JOIN products p ON p.id = b.service_id
             JOIN users u ON u.id = b.seller_id
             WHERE b.id = $1 AND b.buyer_id = $2 AND b.status = 'confirmed'
               AND (b.booking_date + b.booking_time::time) > NOW()`,
            [req.params.id, req.userId]
        );
        const b = r.rows[0];
        if (!b) return res.status(404).json({ error: 'This booking can no longer be rescheduled.' });

        const duration = Number(b.duration_minutes) || 60;
        let startMin = toMin(booking_time);
        let queued = false;

        if (b.services_paused_until) {
            const p = new Date(b.services_paused_until);
            const pDate = p.toISOString().slice(0, 10);
            if (pDate > String(booking_date).slice(0, 10)) {
                return res.status(409).json({ error: 'This provider is unavailable on this day. Pick a later day.' });
            }
            if (pDate === String(booking_date).slice(0, 10)) {
                const pMin = p.getUTCHours() * 60 + p.getUTCMinutes();
                if (pMin > startMin) { startMin = pMin; queued = true; }
            }
        }

        const others = await pool.query(
            `SELECT booking_time, duration_minutes FROM bookings
             WHERE service_id = $1 AND booking_date = $2 AND id <> $3
               AND (status = 'confirmed'
                    OR (status = 'pending_payment' AND created_at > NOW() - INTERVAL '15 minutes'))`,
            [b.service_id, booking_date, b.id]
        );
        let moved = true;
        while (moved) {
            moved = false;
            for (const row of others.rows) {
                const s = toMin(row.booking_time);
                const e = s + (Number(row.duration_minutes) || 60);
                if (startMin < e && s < startMin + duration) {
                    startMin = e; queued = true; moved = true;
                }
            }
        }
        if (startMin >= 1440) {
            return res.status(409).json({ error: 'This provider has no more free slots on this day. Pick another day.' });
        }

        const finalTime = toTime(startMin);
        await pool.query(
            `UPDATE bookings SET booking_date = $1, booking_time = $2, starting_notified = FALSE, updated_at = NOW()
             WHERE id = $3`,
            [booking_date, finalTime, b.id]
        );
        await insertNotification(
            b.seller_id, 'booking_rescheduled',
            `A buyer moved their "${b.service_title}" booking to ${booking_date} at ${finalTime}.`,
            b.id, `/dashboard?tab=orders`
        );
        res.json({ success: true, booking_time: finalTime, queued });
    } catch (err) {
        console.error('Reschedule booking error:', err);
        res.status(500).json({ error: 'Could not reschedule this booking.' });
    }
});

// POST /api/bookings/:id/no-show — buyer reports a completed booking as a no-show (within 48 hours)
router.post('/:id/no-show', requireAuth, async (req, res) => {
    try {
        const r = await pool.query(
            `UPDATE bookings SET status = 'no_show', updated_at = NOW()
             WHERE id = $1 AND buyer_id = $2 AND status = 'completed'
               AND updated_at > NOW() - INTERVAL '48 hours'
             RETURNING id, seller_id, service_id`,
            [req.params.id, req.userId]
        );
        const b = r.rows[0];
        if (!b) return res.status(404).json({ error: 'This booking can no longer be reported.' });

        const t = await pool.query('SELECT title FROM products WHERE id = $1', [b.service_id]);
        await insertNotification(
            b.seller_id, 'booking_no_show',
            `A buyer reported a no-show for "${t.rows[0]?.title || 'your service'}". No fee is charged for this booking.`,
            b.id, `/dashboard?tab=orders`
        );
        const recent = await pool.query(
            `SELECT COUNT(*)::int AS n FROM bookings
             WHERE seller_id = $1 AND status = 'no_show'
               AND updated_at > NOW() - INTERVAL '30 days'`,
            [b.seller_id]
        );
        if (recent.rows[0].n >= 3) {
            const sellerRow = await pool.query('SELECT name FROM users WHERE id = $1', [b.seller_id]);
            const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin'`);
            for (const a of admins.rows) {
                await insertNotification(
                    a.id, 'no_show_flag',
                    `${sellerRow.rows[0]?.name || 'A provider'} has ${recent.rows[0].n} no-show reports in the last 30 days. Please review.`,
                    b.seller_id, null
                );
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('No-show report error:', err);
        res.status(500).json({ error: 'Could not send your report.' });
    }
});

// Expose the processor for the main webhook
module.exports = {
    router,
    processBookingWebhookEvent,
};