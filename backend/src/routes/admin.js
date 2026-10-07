const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSupportReplyEmail } = require('../utils/mailer');
const { insertNotification } = require('../utils/notifications');

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
            `SELECT id, name, university_email, account_type, role, verified, banned, is_data_seller, created_at, plan, plan_expires_at
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

// POST /api/admin/users/:id/force-logout — invalidate the user's active session
// without banning them. Boots whoever's currently signed in on their next request.
router.post('/users/:id/force-logout', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'UPDATE users SET session_id = NULL WHERE id = $1 RETURNING id, name, university_email',
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User has been signed out of all sessions', user: result.rows[0] });
    } catch (err) {
        console.error('Admin force logout error:', err);
        res.status(500).json({ error: 'Something went wrong signing this user out' });
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

// GET /api/admin/orders/overdue — missed deliveries, buyers silent after delivery, and buyer reports
router.get('/orders/overdue', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT o.id, o.status, o.total_amount, o.created_at, o.delivered_at,
                    CASE
                        WHEN o.reported_at IS NOT NULL THEN 'reported'
                        WHEN o.flagged_overdue_at IS NOT NULL THEN 'unconfirmed'
                        ELSE 'not_delivered'
                    END AS overdue_reason,
                    COALESCE(o.reported_at, o.flagged_overdue_at, o.overdue_flagged_at) AS flagged_at,
                    u.name AS buyer_name, u.university_email AS buyer_email, u.whatsapp AS buyer_whatsapp
             FROM orders o
             JOIN users u ON u.id = o.buyer_id
             WHERE o.status = 'paid'
               AND (o.overdue_flagged_at IS NOT NULL OR o.flagged_overdue_at IS NOT NULL OR o.reported_at IS NOT NULL)
             ORDER BY COALESCE(o.reported_at, o.flagged_overdue_at, o.overdue_flagged_at) DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get overdue orders error:', err);
        res.status(500).json({ error: 'Something went wrong fetching overdue orders' });
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

// DELETE /api/admin/users/:id — permanently delete a user and everything tied to them
router.delete('/users/:id', async (req, res) => {
    const userId = req.params.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Order matters. Children first, user last — or Postgres blocks with FK errors.
        // Every FK referencing users(id) or products(id) must be cleared before
        // this user's rows in those two tables are deleted.

        // Service bookings — as buyer/seller, or booked against one of this seller's service listings
        await client.query(
            `DELETE FROM bookings
             WHERE seller_id = $1 OR buyer_id = $1
                OR service_id IN (SELECT id FROM products WHERE seller_id = $1)`,
            [userId]
        );

        // Business profiles
        await client.query('DELETE FROM business_profiles WHERE user_id = $1', [userId]);

        // Buyer delivery locations
        await client.query('DELETE FROM buyer_delivery_locations WHERE buyer_id = $1', [userId]);

        // Chat wallpaper overrides + wallpapers — by this user, or on any
        // conversation this user is part of (so another participant's
        // wallpaper setting on a shared conversation doesn't block deletion)
        await client.query(
            `DELETE FROM chat_wallpaper_overrides
             WHERE user_id = $1
                OR conversation_id IN (SELECT id FROM conversations WHERE buyer_id = $1 OR seller_id = $1)`,
            [userId]
        );
        await client.query(
            `DELETE FROM chat_wallpapers
             WHERE set_by = $1
                OR conversation_id IN (SELECT id FROM conversations WHERE buyer_id = $1 OR seller_id = $1)`,
            [userId]
        );

        // Conversation deletions
        await client.query('DELETE FROM conversation_deletions WHERE user_id = $1', [userId]);

        // Message deletions — by this user, or referencing any message this
        // user sent or that lives in a conversation this user is part of
        await client.query(
            `DELETE FROM message_deletions
             WHERE user_id = $1
                OR message_id IN (
                    SELECT id FROM messages WHERE sender_id = $1
                       OR conversation_id IN (SELECT id FROM conversations WHERE buyer_id = $1 OR seller_id = $1)
                )`,
            [userId]
        );

        // Messages (by sender, or in any conversation this user is part of) + conversations
        await client.query(
            `DELETE FROM messages WHERE sender_id = $1
              OR conversation_id IN (SELECT id FROM conversations WHERE buyer_id = $1 OR seller_id = $1)`,
            [userId]
        );
        await client.query('DELETE FROM conversations WHERE buyer_id = $1 OR seller_id = $1', [userId]);

        // Data orders + bundles
        await client.query(
            `UPDATE data_orders SET bundle_id = NULL
             WHERE bundle_id IN (SELECT id FROM data_bundles WHERE seller_id = $1)`,
            [userId]
        );
        await client.query('DELETE FROM data_orders WHERE seller_id = $1 OR buyer_id = $1', [userId]);
        await client.query('DELETE FROM data_bundles WHERE seller_id = $1', [userId]);

        // Email OTPs
        await client.query('DELETE FROM email_otps WHERE user_id = $1', [userId]);

        // Notifications
        await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);

        // Detach orders this user delivered, then wipe order_items + orders
        await client.query('UPDATE orders SET delivered_by_seller_id = NULL WHERE delivered_by_seller_id = $1', [userId]);
        await client.query(
            `DELETE FROM order_items
             WHERE seller_id = $1
                OR order_id IN (SELECT id FROM orders WHERE buyer_id = $1)
                OR product_id IN (SELECT id FROM products WHERE seller_id = $1)`,
            [userId]
        );
        await client.query('DELETE FROM orders WHERE buyer_id = $1', [userId]);

        // Payout withdrawals, then the payout accounts themselves
        await client.query('DELETE FROM payout_withdrawals WHERE seller_id = $1', [userId]);
        await client.query('DELETE FROM seller_payout_accounts WHERE seller_id = $1', [userId]);

        // Product-scoped tables that must be cleared before the products themselves
        await client.query(
            `DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE seller_id = $1)`,
            [userId]
        );
        await client.query(
            `DELETE FROM product_views
             WHERE user_id = $1 OR product_id IN (SELECT id FROM products WHERE seller_id = $1)`,
            [userId]
        );
        await client.query(
            `DELETE FROM wishlist_items
             WHERE user_id = $1 OR product_id IN (SELECT id FROM products WHERE seller_id = $1)`,
            [userId]
        );
        await client.query(
            `DELETE FROM reports
             WHERE reported_user_id = $1 OR reporter_id = $1
                OR product_id IN (SELECT id FROM products WHERE seller_id = $1)`,
            [userId]
        );

        // Boosts on this seller's products (or bought by this user directly)
        await client.query(
            `DELETE FROM boosts
             WHERE seller_id = $1 OR product_id IN (SELECT id FROM products WHERE seller_id = $1)`,
            [userId]
        );

        // Products
        await client.query('DELETE FROM products WHERE seller_id = $1', [userId]);

        // Reviews — old tables
        await client.query('DELETE FROM review_comments WHERE commenter_id = $1', [userId]);
        await client.query('DELETE FROM review_likes WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM reviews WHERE reviewer_id = $1 OR seller_id = $1', [userId]);
        await client.query('DELETE FROM review_skips WHERE buyer_id = $1 OR seller_id = $1', [userId]);

        // Reviews — newer tables (product_id-based rows already cleared above)
        await client.query('DELETE FROM product_review_comments WHERE commenter_id = $1', [userId]);
        await client.query('DELETE FROM product_review_likes WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM product_reviews WHERE user_id = $1', [userId]);

        // Subscriptions
        await client.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);

        // Saved searches
        await client.query('DELETE FROM saved_searches WHERE buyer_id = $1', [userId]);

        // Seller payments and rewards
        await client.query('DELETE FROM seller_payments WHERE seller_id = $1', [userId]);
        await client.query('DELETE FROM seller_rewards WHERE seller_id = $1', [userId]);

        // Support requests
        await client.query('DELETE FROM support_requests WHERE user_id = $1', [userId]);

        // Anyone this user referred — clear the self-referencing link so it
        // doesn't block deletion; the referral itself just becomes untracked.
        await client.query('UPDATE users SET referred_by = NULL WHERE referred_by = $1', [userId]);

        // Finally, the user
        await client.query('DELETE FROM users WHERE id = $1', [userId]);

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

// POST /api/admin/orders/:id/release — admin confirms receipt for the buyer and releases the sellers' money
router.post('/orders/:id/release', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    const fail = async (status, error) => {
        await client.query('ROLLBACK');
        return res.status(status).json({ error });
    };
    try {
        await client.query('BEGIN');

        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        const order = orderResult.rows[0];
        if (!order) return fail(404, 'Order not found');
        if (order.status !== 'paid') return fail(400, 'Only paid orders can be released');
        if (!order.delivered_at) return fail(400, 'The seller has not marked this order as delivered');

        const itemsResult = await client.query(
            `SELECT * FROM order_items
             WHERE order_id = $1 AND buyer_confirmed_at IS NULL AND status <> 'cancelled' AND delivered_at IS NOT NULL`,
            [id]
        );
        if (itemsResult.rows.length === 0) return fail(400, 'Nothing left to release on this order');

        const paidBySeller = {};
        for (const item of itemsResult.rows) {
            const goods = parseFloat(item.price_at_purchase) * item.quantity;
            const adminNetProfit = Math.round(
                (goods * 0.02 + parseFloat(item.platform_fee || 0) + parseFloat(item.admin_delivery_share || 0)) * 100
            ) / 100;

            await client.query(
                `UPDATE order_items SET buyer_confirmed_at = now(), status = 'completed', admin_net_profit = $1 WHERE id = $2`,
                [adminNetProfit, item.id]
            );
            paidBySeller[item.seller_id] = (paidBySeller[item.seller_id] || 0) + parseFloat(item.seller_earnings || 0);
        }
        const stillOpen = await client.query(
            `SELECT 1 FROM order_items WHERE order_id = $1 AND buyer_confirmed_at IS NULL AND status <> 'cancelled' LIMIT 1`,
            [id]
        );
        if (stillOpen.rows.length === 0) {
            await client.query(`UPDATE orders SET status = 'completed' WHERE id = $1`, [id]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Payment released to seller' });

        try {
        for (const [sellerId, amount] of Object.entries(paidBySeller)) {
            await insertNotification(
                sellerId,
                'funds_available',
                `💰 GHS ${amount.toFixed(2)} for Order #${id} was released to your Payouts tab after our team reviewed it.`,
                id,
                '/dashboard?tab=payouts'
            );
        }
        await insertNotification(
            order.buyer_id,
            'order_released_buyer',
            `Order #${id} was marked as received after a review by our team.`,
            id,
            '/dashboard?tab=orders'
        );

        } catch (notifyErr) {
            console.error('Release notifications failed:', notifyErr);
        }
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin release order error:', err);
        res.status(500).json({ error: 'Something went wrong releasing this order' });
    } finally {
        client.release();
    }
});

// POST /api/admin/orders/:id/refund
// body: { percent: 25|50|75|100, noItemsReceived: boolean }
router.post('/orders/:id/refund', async (req, res) => {
    const { id } = req.params;
    const { percent, noItemsReceived } = req.body;

    if (![25, 50, 75, 100].includes(percent)) {
        return res.status(400).json({ error: 'Invalid refund percentage' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        const order = orderResult.rows[0];
        if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }); }
        if (order.status !== 'paid') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Only paid orders can be refunded this way' }); }

        // Only items still in play: not cancelled (already refunded) and not buyer-confirmed (seller already paid).
        const liveItems = (await client.query(
            `SELECT price_at_purchase, quantity, platform_fee, seller_earnings, admin_delivery_share
             FROM order_items
             WHERE order_id = $1 AND status <> 'cancelled' AND buyer_confirmed_at IS NULL`,
            [id]
        )).rows;
        if (liveItems.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No refundable items left on this order' });
        }

        let goodsTotal = 0;
        let deliveryTotal = 0;
        for (const i of liveItems) {
            const goods = parseFloat(i.price_at_purchase) * i.quantity;
            goodsTotal += goods;
            const sellerDelivery = i.seller_earnings == null
                ? 0
                : parseFloat(i.seller_earnings) - (goods - parseFloat(i.platform_fee || 0));
            deliveryTotal += sellerDelivery + parseFloat(i.admin_delivery_share || 0);
        }
        const subtotalRefund = goodsTotal * (percent / 100);
        const deliveryRefund = noItemsReceived ? deliveryTotal : 0;
        const refundAmount = Math.round((subtotalRefund + deliveryRefund) * 100) / 100;

        const newStatus = percent === 100 ? 'refunded' : 'partially_refunded';
        await client.query(`UPDATE orders SET status = $1 WHERE id = $2`, [newStatus, id]);
        await client.query(
            `UPDATE order_items SET status = $1 WHERE order_id = $2 AND status <> 'cancelled' AND buyer_confirmed_at IS NULL`,
            [newStatus, id]
        );
        await client.query('UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2', [refundAmount, order.buyer_id]);

        await client.query('COMMIT');

        await insertNotification(
            order.buyer_id,
            'order_refunded',
            `Order #${id} was ${percent < 100 ? `partially (${percent}%)` : 'fully'} refunded as GHS ${refundAmount.toFixed(2)} credit to your account.`,
            id,
            '/dashboard?tab=orders'
        ).catch((err) => console.error('Refund notification failed:', err));

        res.json({ message: 'Order refunded', refundAmount });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin refund order error:', err);
        res.status(500).json({ error: 'Something went wrong refunding this order' });
    } finally {
        client.release();
    }
});

// POST /api/admin/users/:id/set-data-seller — exclusively assigns (or revokes) the
// Mobile Data seller role. Only one user can ever hold this at a time: assigning it
// to a new user clears it from whoever had it before and wipes their bundles.
router.post('/users/:id/set-data-seller', async (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body; // true = assign to this user, false = revoke from this user

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const targetResult = await client.query('SELECT id FROM users WHERE id = $1', [id]);
        if (targetResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }

        if (enabled) {
            // Revoke from whoever currently has it (should be at most one person)
            const previousHolders = await client.query(
                `SELECT id FROM users WHERE is_data_seller = true AND id != $1`,
                [id]
            );
            for (const holder of previousHolders.rows) {
                await client.query(
                    `UPDATE data_orders SET bundle_id = NULL
                     WHERE bundle_id IN (SELECT id FROM data_bundles WHERE seller_id = $1)`,
                    [holder.id]
                );
                await client.query('DELETE FROM data_bundles WHERE seller_id = $1', [holder.id]);
            }
            await client.query('UPDATE users SET is_data_seller = false WHERE id != $1', [id]);
            await client.query('UPDATE users SET is_data_seller = true WHERE id = $1', [id]);
        } else {
            await client.query('UPDATE users SET is_data_seller = false WHERE id = $1', [id]);
            await client.query(
                `UPDATE data_orders SET bundle_id = NULL
                 WHERE bundle_id IN (SELECT id FROM data_bundles WHERE seller_id = $1)`,
                [id]
            );
            await client.query('DELETE FROM data_bundles WHERE seller_id = $1', [id]);
        }

        await client.query('COMMIT');

        const updated = await pool.query(
            'SELECT id, name, university_email, is_data_seller FROM users WHERE id = $1',
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Admin set data seller error:', err);
        res.status(500).json({ error: 'Something went wrong updating data seller status' });
    } finally {
        client.release();
    }
});

// POST /api/admin/users/:id/set-plan — manually grant/revoke Pro or Premium.
// Uses the same durations as a normal purchase (Pro = 1 month, Premium = 1 year).
// Passing 'free' clears the plan back to free immediately.
router.post('/users/:id/set-plan', async (req, res) => {
    const { id } = req.params;
    const { plan } = req.body; // 'free' | 'pro' | 'premium'

    if (!['free', 'pro', 'premium'].includes(plan)) {
        return res.status(400).json({ error: 'Invalid plan' });
    }

    try {
        let expiresAt = null;
        if (plan === 'pro') {
            expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else if (plan === 'premium') {
            expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        }

        const result = await pool.query(
            `UPDATE users SET plan = $1, plan_expires_at = $2 WHERE id = $3
             RETURNING id, name, university_email, plan, plan_expires_at`,
            [plan, expiresAt, id]
        );
        if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Admin set plan error:', err);
        res.status(500).json({ error: 'Something went wrong updating this user\'s plan' });
    }
});

// GET /api/admin/support — list all support requests, unresolved+paid-plan first
router.get('/support', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT sr.id, sr.message, sr.status, sr.created_at,
                    u.id AS user_id, u.name AS user_name, u.university_email AS user_email,
                    u.plan, u.plan_expires_at
             FROM support_requests sr
             JOIN users u ON u.id = sr.user_id
             ORDER BY
                CASE WHEN sr.status = 'pending' THEN 0 ELSE 1 END,
                CASE
                    WHEN u.plan = 'premium' AND u.plan_expires_at > now() THEN 0
                    WHEN u.plan = 'pro' AND u.plan_expires_at > now() THEN 1
                    ELSE 2
                END,
                sr.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get support requests error:', err);
        res.status(500).json({ error: 'Something went wrong fetching support requests' });
    }
});

// PATCH /api/admin/support/:id — mark resolved (no reply)
router.patch('/support/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE support_requests SET status = 'resolved' WHERE id = $1 RETURNING *`,
            [req.params.id]
        );
        if (!result.rows[0]) return res.status(404).json({ error: 'Request not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Admin update support request error:', err);
        res.status(500).json({ error: 'Something went wrong updating this request' });
    }
});

// POST /api/admin/support/:id/reply — send a reply, resolve, and email the user
router.post('/support/:id/reply', async (req, res) => {
    const { reply } = req.body;
    if (!reply || !reply.trim()) {
        return res.status(400).json({ error: 'Reply message is required' });
    }

    try {
        const requestResult = await pool.query(
            `SELECT sr.id, sr.message, sr.user_id, u.account_type, u.personal_email, u.university_email
             FROM support_requests sr
             JOIN users u ON u.id = sr.user_id
             WHERE sr.id = $1`,
            [req.params.id]
        );
        const request = requestResult.rows[0];
        if (!request) return res.status(404).json({ error: 'Request not found' });

        const destinationEmail = request.account_type === 'buyer'
            ? request.university_email
            : request.personal_email;

        if (!destinationEmail) {
            return res.status(400).json({ error: 'This user has no email on file to reply to' });
        }

        const updateResult = await pool.query(
            `UPDATE support_requests SET admin_reply = $1, replied_at = now(), status = 'resolved' WHERE id = $2 RETURNING *`,
            [reply.trim(), req.params.id]
        );

        await sendSupportReplyEmail(destinationEmail, request.message, reply.trim());

        res.json(updateResult.rows[0]);
    } catch (err) {
        console.error('Admin reply support request error:', err);
        res.status(500).json({ error: 'Something went wrong sending this reply' });
    }
});

// ─── Tre-X broadcast / direct messaging ────────────────────────────────
const TREX_ID = '09dabd6c-c9ea-440d-b42a-0ba1d9011e8a';

// Send a Tre-X message to one user. Creates the conversation if it doesn't
// exist, then inserts the message from Tre-X.
async function sendTrexMessage(client, recipientId, content) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Message is empty');

  // Find or create the Tre-X ↔ recipient conversation
  let convoId;
  const existing = await client.query(
    `SELECT id FROM conversations
     WHERE buyer_id = $1 AND seller_id = $2 AND product_id IS NULL`,
    [recipientId, TREX_ID]
  );
  if (existing.rows.length > 0) {
    convoId = existing.rows[0].id;
  } else {
    const inserted = await client.query(
      `INSERT INTO conversations (buyer_id, seller_id, product_id)
       VALUES ($1, $2, NULL) RETURNING id`,
      [recipientId, TREX_ID]
    );
    convoId = inserted.rows[0].id;
  }

  await client.query(
    `INSERT INTO messages (conversation_id, sender_id, content, read, media_type)
     VALUES ($1, $2, $3, FALSE, NULL)`,
    [convoId, TREX_ID, trimmed]
  );

  return convoId;
}

// GET /api/admin/message/accounts — every user (for the individual picker)
router.get('/message/accounts', async (req, res) => {
  const q = (req.query.q || '').trim();
  try {
    const params = [];
    let where = `WHERE id != $1 AND role != 'system'`;
    params.push(TREX_ID);

    if (q) {
      params.push(`%${q}%`);
      where += ` AND (name ILIKE $${params.length} OR university_email ILIKE $${params.length})`;
    }

    const result = await pool.query(
      `SELECT id, name, username, university_email, account_type, avatar_url
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT 100`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Admin message accounts error:', err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// POST /api/admin/message/individual
// body: { userId, content }
router.post('/message/individual', async (req, res) => {
  const { userId, content } = req.body;
  if (!userId || !content?.trim()) {
    return res.status(400).json({ error: 'userId and content are required' });
  }

  try {
    const target = await pool.query(
      `SELECT id, name FROM users WHERE id = $1 AND role != 'system'`,
      [userId]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const convoId = await sendTrexMessage(pool, userId, content);

    // Fire a push so they see it immediately
    insertNotification(
      userId,
      'new_message',
      `Tre-X: ${content.trim().slice(0, 100)}`,
      convoId,
      `/chat/${convoId}`,
      'Tre-X',
      content.trim().slice(0, 100)
    ).catch((err) => console.error('Tre-X push error:', err));

    res.json({ success: true, conversationId: convoId });
  } catch (err) {
    console.error('Admin individual message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/admin/message/group
// body: { group: 'all' | 'sellers' | 'buyers', content }
router.post('/message/group', async (req, res) => {
  const { group, content } = req.body;
  if (!['all', 'sellers', 'buyers'].includes(group) || !content?.trim()) {
    return res.status(400).json({ error: 'Valid group and content are required' });
  }

  try {
    let where = `WHERE role != 'system' AND banned = FALSE`;
    if (group === 'sellers') where += ` AND account_type = 'seller'`;
    if (group === 'buyers') where += ` AND account_type = 'buyer'`;

    const recipients = await pool.query(`SELECT id FROM users ${where}`);

    let sent = 0;
    for (const row of recipients.rows) {
      try {
        const convoId = await sendTrexMessage(pool, row.id, content);
        insertNotification(
          row.id,
          'new_message',
          `Tre-X: ${content.trim().slice(0, 100)}`,
          convoId,
          `/chat/${convoId}`,
          'Tre-X',
          content.trim().slice(0, 100)
        ).catch(() => {});
        sent++;
      } catch (err) {
        console.error(`Failed to message user ${row.id}:`, err.message);
      }
    }

    res.json({ success: true, sent, total: recipients.rows.length });
  } catch (err) {
    console.error('Admin group message error:', err);
    res.status(500).json({ error: 'Failed to send group message' });
  }
});

module.exports = router;