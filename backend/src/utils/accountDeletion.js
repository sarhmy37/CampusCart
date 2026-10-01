const pool = require('../db/pool');

async function getDeletionBlocker(userId) {
    // Buyer: paid orders the buyer hasn't fully confirmed yet
    const buyerOrders = await pool.query(
        `SELECT 1 FROM orders WHERE buyer_id = $1 AND status = 'paid' LIMIT 1`,
        [userId]
    );
    if (buyerOrders.rows.length > 0) {
        return 'You have an order that is not completed yet. Please complete it before deleting your account.';
    }

    // Seller: items in paid orders that are not yet confirmed, cancelled or refunded
    const sellerItems = await pool.query(
        `SELECT 1 FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.seller_id = $1 AND o.status = 'paid'
           AND oi.buyer_confirmed_at IS NULL
           AND oi.status NOT IN ('cancelled', 'refunded', 'partially_refunded')
         LIMIT 1`,
        [userId]
    );
    if (sellerItems.rows.length > 0) {
        return 'You have orders that are not completed yet. Please complete them before deleting your account.';
    }

    // Mobile data orders still pending, as buyer or seller
    const dataOrders = await pool.query(
        `SELECT 1 FROM data_orders WHERE (buyer_id = $1 OR seller_id = $1) AND status = 'pending' LIMIT 1`,
        [userId]
    );
    if (dataOrders.rows.length > 0) {
        return 'You have a data order that is not completed yet. Please complete it before deleting your account.';
    }

    return null;
}

async function blockDeleteIfOrdersOpen(req, res, next) {
    try {
        const message = await getDeletionBlocker(req.userId);
        if (message) return res.status(409).json({ error: message });
        next();
    } catch (err) {
        console.error('Deletion check error:', err);
        res.status(500).json({ error: "Couldn't check your orders. Please try again." });
    }
}

module.exports = { getDeletionBlocker, blockDeleteIfOrdersOpen };