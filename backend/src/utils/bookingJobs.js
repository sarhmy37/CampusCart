const pool = require('../db/pool');
const { insertNotification } = require('./notifications');
const { refundTransaction, getRefundStatus } = require('./paystack');
const { getSellerFeeRate } = require('./plans');

async function titleOf(serviceId) {
    const r = await pool.query('SELECT title FROM products WHERE id = $1', [serviceId]);
    return r.rows[0]?.title || 'Service';
}

async function refundBooking(booking, finalStatus = 'expired_no_reply') {
    if (!booking.payment_reference) return;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const claimed = await client.query(
            `UPDATE bookings SET refund_status = 'processing', refund_target_status = $3, updated_at = NOW()
             WHERE id = $1 AND refund_status IN ('not_requested', 'failed')
               AND status = ANY($2::text[]) AND provider_first_reply_at IS NULL RETURNING *`,
            [booking.id, ['confirmed'], finalStatus]
        );
        if (claimed.rowCount !== 1) {
            await client.query('ROLLBACK');
            return;
        }
        await client.query('COMMIT');
        try {
            // Refund exactly GHS 2; Paystack fees remain absorbed by the platform.
            await refundTransaction(booking.payment_reference, 2);
            await pool.query(
                `UPDATE bookings SET refund_status = 'refunded', status = $1, updated_at = NOW()
                 WHERE id = $2 AND refund_status = 'processing'`,
                [finalStatus, booking.id]
            );
            const title = await titleOf(booking.service_id);
            await insertNotification(booking.buyer_id, 'booking_refunded',
                `Your booking for "${title}" was refunded.`, `booking-${booking.id}`, '/dashboard?tab=orders');
            await insertNotification(booking.seller_id, finalStatus === 'declined' ? 'booking_declined' : 'booking_expired',
                finalStatus === 'declined'
                    ? `You declined the booking for "${title}".`
                    : `The booking for "${title}" expired because no reply was sent in time.`,
                `booking-${booking.id}`, '/dashboard?tab=tasks');
        } catch (err) {
            await pool.query(
                `UPDATE bookings SET refund_status = 'failed', updated_at = NOW()
                 WHERE id = $1 AND refund_status = 'processing'`,
                [booking.id]
            );
            console.error(`Booking refund failed for ${booking.id}; will retry:`, err);
        }
    } catch (err) {
        try { await client.query('ROLLBACK'); } catch {}
        console.error('Booking refund claim error:', err);
    } finally {
        client.release();
    }
}

async function billBookingFee(booking) {
    const result = await pool.query(
        `SELECT b.id, b.service_amount, u.plan, u.plan_expires_at
         FROM bookings b JOIN users u ON u.id = b.seller_id
         WHERE b.id = $1 AND b.fee_billed_at IS NULL
           AND b.status IN ('confirmed', 'completed')`,
        [booking.id]
    );
    const row = result.rows[0];
    if (!row) return;
    const rate = getSellerFeeRate(row.plan, row.plan_expires_at);
    const fee = Math.round(Number(row.service_amount) * rate * 100) / 100;
    await pool.query(
        `UPDATE bookings SET seller_fee = $1, seller_earnings = $2, fee_billed_at = NOW(), updated_at = NOW()
         WHERE id = $3 AND fee_billed_at IS NULL`,
        [fee, Math.round((Number(row.service_amount) - fee) * 100) / 100, row.id]
    );
}

async function recoverProcessingRefunds() {
    const result = await pool.query(
        `SELECT * FROM bookings
         WHERE refund_status = 'processing'
           AND updated_at < NOW() - INTERVAL '10 minutes'
           AND payment_reference IS NOT NULL`
    );
    for (const booking of result.rows) {
        try {
            const response = await getRefundStatus(booking.payment_reference);
            const refunds = Array.isArray(response.data) ? response.data : [];
            const refund = refunds[0];
            const status = String(refund?.status || '').toLowerCase();
            if (['processed', 'successful', 'completed'].includes(status)) {
                const updated = await pool.query(
                    `UPDATE bookings SET refund_status = 'refunded',
                            status = COALESCE(refund_target_status, 'expired_no_reply'),
                            updated_at = NOW()
                     WHERE id = $1 AND refund_status = 'processing' RETURNING id`,
                    [booking.id]
                );
                if (updated.rowCount) {
                    const title = await titleOf(booking.service_id);
                    await insertNotification(booking.buyer_id, 'booking_refunded',
                        `Your booking for "${title}" was refunded.`, `booking-${booking.id}`, '/dashboard?tab=orders');
                }
            } else if (!refund || ['failed', 'rejected'].includes(status)) {
                await pool.query(
                    `UPDATE bookings SET refund_status = 'failed', updated_at = NOW()
                     WHERE id = $1 AND refund_status = 'processing'`,
                    [booking.id]
                );
            }
        } catch (err) {
            console.error(`Could not recover booking refund ${booking.id}:`, err);
        }
    }
}

async function runBookingJobs() {
    try {
        await recoverProcessingRefunds();
        const due = await pool.query(
            `SELECT * FROM bookings
             WHERE status = 'confirmed' AND reply_deadline_at IS NOT NULL
               AND reply_deadline_at <= NOW() AND provider_first_reply_at IS NULL`
        );
        for (const booking of due.rows) await refundBooking(booking);

        const reminders = await pool.query(
            `SELECT * FROM bookings
             WHERE status = 'confirmed' AND reply_deadline_at IS NOT NULL
               AND reminder_sent_at IS NULL
               AND provider_first_reply_at IS NULL
               AND NOW() >= (paid_at + ((reply_deadline_at - paid_at) / 2))`
        );
        for (const booking of reminders.rows) {
            const claimed = await pool.query(
                `UPDATE bookings SET reminder_sent_at = NOW()
                 WHERE id = $1 AND reminder_sent_at IS NULL RETURNING id`,
                [booking.id]
            );
            if (claimed.rowCount) {
                await insertNotification(booking.seller_id, 'booking_reminder',
                    'Reply to your booking or the buyer will be refunded.',
                    `booking-${booking.id}`, '/dashboard?tab=tasks');
            }
        }

        const serviceDue = await pool.query(
            `SELECT * FROM bookings
             WHERE status = 'confirmed'
              AND COALESCE(refund_status, 'not_requested') = 'not_requested'
              AND (reply_deadline_at IS NULL OR provider_first_reply_at IS NOT NULL)
              AND (booking_date + booking_time::time +
                    (COALESCE(duration_minutes, 60) || ' minutes')::interval) <= NOW()`
        );
        for (const booking of serviceDue.rows) {
            await billBookingFee(booking);
            const updated = await pool.query(
                `UPDATE bookings SET status = 'completed', updated_at = NOW()
                 WHERE id = $1 AND status = 'confirmed' RETURNING id`,
                [booking.id]
            );
            if (updated.rowCount) {
                const title = await titleOf(booking.service_id);
                await insertNotification(booking.buyer_id, 'booking_completed',
                    `Your booking for "${title}" is now complete. You can leave a review.`,
                    `booking-${booking.id}`, '/dashboard?tab=orders');
                await insertNotification(booking.seller_id, 'booking_completed',
                    `Your booking for "${title}" was completed.`, `booking-${booking.id}`, '/dashboard?tab=tasks');
            }
        }
    } catch (err) {
        console.error('Booking jobs error:', err);
    }
}

function startBookingJobs() {
    runBookingJobs();
    setInterval(runBookingJobs, 60 * 1000);
}

module.exports = { startBookingJobs, refundBooking, billBookingFee, recoverProcessingRefunds };
