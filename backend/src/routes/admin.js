const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
    try {
        const users = await pool.query('SELECT COUNT(*) FROM users');
        const products = await pool.query('SELECT COUNT(*) FROM products');
        const orders = await pool.query("SELECT COUNT(*) FROM orders WHERE status = 'completed'");
        const revenue = await pool.query(
            "SELECT COALESCE(SUM(platform_fee), 0) AS total FROM order_items WHERE status = 'completed'"
        );

        res.json({
            total_users: parseInt(users.rows[0].count, 10),
            total_products: parseInt(products.rows[0].count, 10),
            total_orders: parseInt(orders.rows[0].count, 10),
            total_revenue: parseFloat(revenue.rows[0].total),
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Something went wrong fetching stats' });
    }
});

// GET /api/admin/net-earnings
router.get('/net-earnings', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COALESCE(SUM(o.subtotal * 0.02), 0) as total_buyer_fees,
                COALESCE(SUM(oi.platform_fee), 0) as total_seller_fees,
                COALESCE(SUM(o.delivery_fee * 0.20), 0) as total_admin_delivery_fees,
                COALESCE(SUM(o.subtotal + o.delivery_fee), 0) as total_revenue_processed,
                COALESCE(SUM(oi.admin_net_profit), 0) as total_admin_net_profit
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.status = 'completed' AND oi.buyer_confirmed_at IS NOT NULL
        `);

        const data = result.rows[0];
        
        const grossAdminProfit = parseFloat(data.total_buyer_fees) + parseFloat(data.total_seller_fees) + parseFloat(data.total_admin_delivery_fees);
        const paystackFee = parseFloat(data.total_revenue_processed) * 0.0195;
        const netAdminProfit = parseFloat(data.total_admin_net_profit);

        res.json({
            totalBuyerFees: parseFloat(data.total_buyer_fees).toFixed(2),
            totalSellerFees: parseFloat(data.total_seller_fees).toFixed(2),
            totalAdminDeliveryFees: parseFloat(data.total_admin_delivery_fees).toFixed(2),
            grossProfit: grossAdminProfit.toFixed(2),
            paystackDeduction: paystackFee.toFixed(2),
            netProfit: netAdminProfit.toFixed(2),
            totalRevenueProcessed: parseFloat(data.total_revenue_processed).toFixed(2)
        });

    } catch (err) {
        console.error('Admin net earnings error:', err);
        res.status(500).json({ error: 'Something went wrong fetching admin earnings' });
    }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, university_email, account_type, role, verified, banned, created_at
             FROM users ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get users error:', err);
        res.status(500).json({ error: 'Something went wrong fetching users' });
    }
});

// PATCH /api/admin/users/:id — ban/unban, verify/unverify, change role
router.patch('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { banned, verified, role } = req.body;

    try {
        const result = await pool.query(
            `UPDATE users SET
                banned = COALESCE($1, banned),
                verified = COALESCE($2, verified),
                role = COALESCE($3, role)
             WHERE id = $4
             RETURNING id, name, university_email, account_type, role, verified, banned`,
            [banned, verified, role, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Admin update user error:', err);
        res.status(500).json({ error: 'Something went wrong updating this user' });
    }
});

// GET /api/admin/listings
router.get('/listings', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.id, p.title, p.price, p.stock, p.primary_image, p.created_at,
                    u.name AS seller_name, u.university_email AS seller_email
             FROM products p
             JOIN users u ON u.id = p.seller_id
             ORDER BY p.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get listings error:', err);
        res.status(500).json({ error: 'Something went wrong fetching listings' });
    }
});

// DELETE /api/admin/listings/:id
router.delete('/listings/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.json({ message: 'Listing removed' });
    } catch (err) {
        console.error('Admin delete listing error:', err);
        res.status(500).json({ error: 'Something went wrong removing this listing' });
    }
});

// GET /api/admin/orders
router.get('/orders', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT o.id, o.status, o.delivery_method, o.total_amount, o.created_at,
                    u.name AS buyer_name, u.university_email AS buyer_email
             FROM orders o
             JOIN users u ON u.id = o.buyer_id
             ORDER BY o.created_at DESC
             LIMIT 200`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get orders error:', err);
        res.status(500).json({ error: 'Something went wrong fetching orders' });
    }
});

// GET /api/admin/orders/search?q=... — search by order ID, buyer name/email, or item title
router.get('/orders/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    try {
        const result = await pool.query(
            `SELECT DISTINCT o.id, o.status, o.delivery_method, o.total_amount, o.created_at,
                    u.name AS buyer_name, u.university_email AS buyer_email
             FROM orders o
             JOIN users u ON u.id = o.buyer_id
             LEFT JOIN order_items oi ON oi.order_id = o.id
             WHERE o.id::text ILIKE $1
                OR u.name ILIKE $1
                OR u.university_email ILIKE $1
                OR oi.title ILIKE $1
             ORDER BY o.created_at DESC
             LIMIT 50`,
            [`%${q}%`]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin search orders error:', err);
        res.status(500).json({ error: 'Something went wrong searching orders' });
    }
});

// GET /api/admin/orders/:id — full detail for one order
router.get('/orders/:id', async (req, res) => {
    try {
        const orderResult = await pool.query(
            `SELECT o.*, u.name AS buyer_name, u.university_email AS buyer_email,
                    u.whatsapp AS buyer_whatsapp, u.location AS buyer_location
             FROM orders o
             JOIN users u ON u.id = o.buyer_id
             WHERE o.id = $1`,
            [req.params.id]
        );
        const order = orderResult.rows[0];
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const itemsResult = await pool.query(
            `SELECT oi.*, s.name AS seller_name, s.university_email AS seller_email,
                    s.whatsapp AS seller_whatsapp, s.school AS seller_school
             FROM order_items oi
             JOIN users s ON s.id = oi.seller_id
             WHERE oi.order_id = $1
             ORDER BY oi.id ASC`,
            [req.params.id]
        );
        order.items = itemsResult.rows;

        res.json(order);
    } catch (err) {
        console.error('Admin get order detail error:', err);
        res.status(500).json({ error: 'Something went wrong fetching this order' });
    }
});

// GET /api/admin/users/:id/orders — get all orders for a user
router.get('/users/:id/orders', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, status, total_amount, created_at
             FROM orders
             WHERE buyer_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get user orders error:', err);
        res.status(500).json({ error: 'Failed to fetch user orders' });
    }
});

// GET /api/admin/users/:id/listings — get all listings for a user
router.get('/users/:id/listings', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, price, stock, status, created_at
             FROM products
             WHERE seller_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get user listings error:', err);
        res.status(500).json({ error: 'Failed to fetch user listings' });
    }
});

// DELETE /api/admin/users/:id — permanently delete a user
router.delete('/users/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE buyer_id = $1)', [req.params.id]);
        await client.query('DELETE FROM orders WHERE buyer_id = $1', [req.params.id]);
        await client.query('DELETE FROM products WHERE seller_id = $1', [req.params.id]);
        await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        await client.query('COMMIT');
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin delete user error:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    } finally {
        client.release();
    }
});

// GET /api/admin/deleted-chats — every "delete for everyone" event, with participants
router.get('/deleted-chats', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                c.id AS conversation_id,
                c.deleted_for_everyone_at,
                c.deleted_for_everyone_by,
                deleter.name AS deleted_by_name,
                deleter.university_email AS deleted_by_email,
                bu.id AS buyer_id, bu.name AS buyer_name, bu.university_email AS buyer_email,
                su.id AS seller_id, su.name AS seller_name, su.university_email AS seller_email,
                p.title AS product_title
             FROM conversations c
             JOIN users bu ON bu.id = c.buyer_id
             JOIN users su ON su.id = c.seller_id
             LEFT JOIN users deleter ON deleter.id = c.deleted_for_everyone_by
             LEFT JOIN products p ON p.id = c.product_id
             WHERE c.deleted_for_everyone_at IS NOT NULL
             ORDER BY c.deleted_for_everyone_at DESC
             LIMIT 200`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get deleted chats error:', err);
        res.status(500).json({ error: 'Something went wrong fetching deleted chats' });
    }
});

// GET /api/admin/deleted-chats/:id/messages — the FULL untouched message history
// for a deleted conversation, ignoring the deleted_for_everyone_at cutoff that
// hides messages from the two participants.
router.get('/deleted-chats/:id/messages', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, sender_id, content, media_url, media_type, read, created_at
             FROM messages WHERE conversation_id = $1
             ORDER BY created_at ASC`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get deleted chat messages error:', err);
        res.status(500).json({ error: 'Something went wrong fetching messages' });
    }
});

// GET /api/admin/orders/overdue
router.get('/orders/overdue', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT o.id, o.status, o.total_amount, o.created_at, o.overdue_flagged_at,
                    u.name AS buyer_name, u.university_email AS buyer_email
             FROM orders o
             JOIN users u ON u.id = o.buyer_id
             WHERE o.overdue_flagged_at IS NOT NULL AND o.status = 'paid'
             ORDER BY o.overdue_flagged_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get overdue orders error:', err);
        res.status(500).json({ error: 'Something went wrong fetching overdue orders' });
    }
});

// POST /api/admin/orders/:id/refund
router.post('/orders/:id/refund', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
        const order = orderResult.rows[0];
        if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }); }
        if (order.status !== 'paid') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Only paid orders can be refunded this way' }); }

        await client.query(`UPDATE orders SET status = 'refunded' WHERE id = $1`, [id]);
        await client.query(`UPDATE order_items SET status = 'refunded' WHERE order_id = $1`, [id]);
        await client.query('UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2', [order.total_amount, order.buyer_id]);

        await client.query('COMMIT');

        await pool.query(
            `INSERT INTO notifications (user_id, type, message, related_id, link) VALUES ($1, $2, $3, $4, $5)`,
            [order.buyer_id, 'order_refunded', `Order #${id} was refunded as GHS ${parseFloat(order.total_amount).toFixed(2)} credit to your account.`, id, '/dashboard?tab=orders']
        );

        res.json({ message: 'Order refunded' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin refund order error:', err);
        res.status(500).json({ error: 'Something went wrong refunding this order' });
    } finally {
        client.release();
    }
});

module.exports = router;