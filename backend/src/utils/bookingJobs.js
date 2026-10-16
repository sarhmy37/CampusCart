const pool = require('../db/pool');
const { insertNotification } = require('./notifications');

async function titleOf(serviceId) {
    const r = await pool.query('SELECT title FROM products WHERE id = $1', [serviceId]);
    return r.rows[0]?.title || 'Service';
}

async function runBookingJobs() {
    try {
        // 1. Auto-complete: the booked time plus its duration has passed
        const done = await pool.query(
            `UPDATE bookings SET status = 'completed', updated_at = NOW()
             WHERE status = 'confirmed'
               AND (booking_date + booking_time::time
                    + (COALESCE(duration_minutes, 60) || ' minutes')::interval) <= NOW()
             RETURNING id, buyer_id, seller_id, service_id`
        );
        for (const b of done.rows) {
            const title = await titleOf(b.service_id);
            await insertNotification(
                b.buyer_id, 'booking_completed',
                `Your booking for "${title}" is now complete. You can leave a review.`,
                b.id, `/dashboard?tab=completed`
            );
            await insertNotification(
                b.seller_id, 'booking_completed',
                `Your booking for "${title}" was completed.`,
                b.id, `/dashboard?tab=completed`
            );
        }

        // 2. Starting soon: within the next 15 minutes
        const soon = await pool.query(
            `UPDATE bookings SET starting_notified = TRUE
             WHERE status = 'confirmed'
               AND starting_notified = FALSE
               AND (booking_date + booking_time::time) > NOW()
               AND (booking_date + booking_time::time) <= NOW() + INTERVAL '15 minutes'
             RETURNING id, buyer_id, seller_id, service_id, booking_time`
        );
        for (const b of soon.rows) {
            const title = await titleOf(b.service_id);
            await insertNotification(
                b.buyer_id, 'booking_soon',
                `Your service "${title}" is about to start (${String(b.booking_time).slice(0, 5)}). Message the provider if you need to.`,
                b.id, `/dashboard?tab=orders`
            );
            await insertNotification(
                b.seller_id, 'booking_soon',
                `A booking for "${title}" starts at ${String(b.booking_time).slice(0, 5)}.`,
                b.id, `/dashboard?tab=orders`
            );
        }
    } catch (err) {
        console.error('Booking jobs error:', err);
    }
}

function startBookingJobs() {
    runBookingJobs();
    setInterval(runBookingJobs, 60 * 1000);
}

module.exports = { startBookingJobs };