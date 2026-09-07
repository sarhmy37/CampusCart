const pool = require('../db/pool');

async function insertNotification(userId, type, message, relatedId, link) {
    await pool.query(
        `INSERT INTO notifications (user_id, type, message, related_id, link) VALUES ($1, $2, $3, $4, $5)`,
        [userId, type, message, relatedId, link]
    );
}

function workingDaysSince(date) {
    let count = 0;
    const now = new Date();
    const cursor = new Date(date);
    while (cursor < now) {
        cursor.setDate(cursor.getDate() + 1);
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) count++;
    }
    return count;
}

async function checkOverdueOrders() {
    try {
        const result = await pool.query(
            `SELECT o.id, o.buyer_id, o.created_at
             FROM orders o
             WHERE o.status = 'paid'
               AND o.delivery_method = 'delivery'
               AND o.delivered_at IS NULL
               AND o.overdue_flagged_at IS NULL`
        );

        for (const order of result.rows) {
            if (workingDaysSince(order.created_at) < 3) continue;

            await pool.query(`UPDATE orders SET overdue_flagged_at = now() WHERE id = $1`, [order.id]);

            const itemsResult = await pool.query(
                `SELECT DISTINCT seller_id FROM order_items WHERE order_id = $1`,
                [order.id]
            );

            await insertNotification(
                order.buyer_id,
                'order_overdue',
                `Order #${order.id} has passed 3 working days without delivery. Our team has been notified and will review it.`,
                order.id,
                `/dashboard?tab=orders`
            );

            for (const item of itemsResult.rows) {
                await insertNotification(
                    item.seller_id,
                    'order_overdue_seller',
                    `Order #${order.id} is overdue for delivery. Please mark it delivered or contact the buyer — this order has been flagged for admin review.`,
                    order.id,
                    `/dashboard?tab=deliveries`
                );
            }

            console.log(`[OVERDUE] Order ${order.id} flagged for review`);
        }
    } catch (err) {
        console.error('Overdue order check failed:', err);
    }
}

module.exports = { checkOverdueOrders };