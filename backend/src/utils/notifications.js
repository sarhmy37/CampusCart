const pool = require('../db/pool');
const { sendPushNotification } = require('./pushService');

const NOTIFICATION_TITLES = {
    new_message: 'New message',
    boost_confirmed: 'Boost confirmed',
    payment_received_seller: 'New order',
    order_delivered_buyer: 'Order delivered',
    funds_available: 'Funds available',
    payment_flagged: 'Payment flagged',
    delivery_reminder: 'Delivery reminder',
};

function getPushTitle(type) {
    return NOTIFICATION_TITLES[type] || 'Tre-X';
}

async function insertNotification(userId, type, message, relatedId = null, link = null) {
    const inserted = await pool.query(
        `INSERT INTO notifications (user_id, type, message, related_id, link, pushed) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
        [userId, type, message, relatedId, link]
    );
    const notificationId = inserted.rows[0].id;

    // Fire the push in the background — don't let a failed/slow push
    // delay or break whatever flow called insertNotification.
    pool.query('SELECT push_token FROM users WHERE id = $1', [userId])
        .then((result) => {
            const pushToken = result.rows[0]?.push_token;
            if (pushToken) {
                sendPushNotification(pushToken, getPushTitle(type), message, { link, related_id: relatedId, type });
                pool.query('UPDATE notifications SET pushed = TRUE WHERE id = $1', [notificationId]).catch(() => {});
            }
        })
        .catch((err) => console.error('Push lookup error:', err));
}

module.exports = { insertNotification, getPushTitle };