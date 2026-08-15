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

module.exports = router;