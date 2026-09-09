const pool = require('../db/pool');

async function insertNotification(userId, type, message, relatedId = null, link = null) {
    await pool.query(
        `INSERT INTO notifications (user_id, type, message, related_id, link) VALUES ($1, $2, $3, $4, $5)`,
        [userId, type, message, relatedId, link]
    );
}

module.exports = { insertNotification };