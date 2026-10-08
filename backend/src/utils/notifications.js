const pool = require('../db/pool');
const { sendPushNotification } = require('./pushService');

const NOTIFICATION_TITLES = {
    new_message: 'New message',
    boost_confirmed: 'Boost confirmed',
    payment_received_seller: 'New order',
    order_delivered_buyer: 'Order marked asdelivered',
    funds_available: 'Funds available',
    payment_flagged: 'Payment flagged',
    delivery_reminder: 'Delivery reminder',
    payment_success_buyer: 'Payment successful',
    order_completed_buyer: 'Order completed',
    order_completed_seller: 'Order completed',
    new_data_order: 'New data order',
    data_order_delivered: 'Data order delivered',
    order_overdue: 'Order overdue',
    order_overdue_seller: 'Order overdue',
    delivery_reminder_buyer: 'Delivery reminder',
    order_cancelled_buyer: 'Order cancelled',
    order_cancelled_seller: 'Order cancelled',
    order_reported_buyer: 'Report received',
    order_reported_seller: 'Order reported',
    subscription_activated: 'Plan activated',
    story_like: 'Tre-X',
    story_comment: 'Tre-X',
};

function getPushTitle(type) {
    return NOTIFICATION_TITLES[type] || 'Tre-X';
}

const API_BASE = process.env.PUBLIC_API_URL || 'https://campuscart-tdfn.onrender.com';

function senderExtra(senderId, senderName, imageUrl = null) {
    return {
        sender_id: senderId,
        sender_name: senderName,
        sender_avatar: `${API_BASE}/api/auth/avatar/${senderId}`,
        ...(imageUrl ? { image_url: imageUrl } : {}),
    };
}

async function insertNotification(userId, type, message, relatedId = null, link = null, pushTitle = null, pushBody = null, extra = {}) {
    const inserted = await pool.query(
        `INSERT INTO notifications (user_id, type, message, related_id, link, pushed, push_title, push_body) VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7) RETURNING id`,
        [userId, type, message, relatedId, link, pushTitle, pushBody]
    );
    const notificationId = inserted.rows[0].id;

    // Fire the push in the background — don't let a failed/slow push
    // delay or break whatever flow called insertNotification.
    pool.query('SELECT push_token FROM users WHERE id = $1', [userId])
        .then((result) => {
            const pushToken = result.rows[0]?.push_token;
            if (pushToken) {
                sendPushNotification(pushToken, pushTitle || getPushTitle(type), pushBody || message, { link, related_id: relatedId, type, ...extra });
                pool.query('UPDATE notifications SET pushed = TRUE WHERE id = $1', [notificationId]).catch(() => {});
            }
        })
        .catch((err) => console.error('Push lookup error:', err));
}

module.exports = { insertNotification, getPushTitle, senderExtra };