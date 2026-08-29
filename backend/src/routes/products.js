const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { isSellerRestricted } = require('./sellers');
const { clampFee } = require('../utils/distance');

const router = express.Router();

router.get('/mine', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.id, p.title, p.price, p.condition, p.stock, p.primary_image, p.video_url, p.created_at,
                    p.rating, p.review_count,
                    p.delivery_fee_on_campus, p.delivery_fee_near_campus, p.delivery_fee_far_campus,
                    c.name AS category
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.seller_id = $1
             ORDER BY p.created_at DESC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get my products error:', err);
        res.status(500).json({ error: 'Something went wrong fetching your listings' });
    }
});

router.get('/', async (req, res) => {
    const { search, category, itemCategory, school } = req.query;
    const categoryFilter = category || itemCategory;

    const conditions = [`p.seller_id NOT IN (SELECT seller_id FROM seller_payments WHERE status = 'overdue')`];
    const values = [];

    if (search) {
        values.push(`%${search}%`);
        conditions.push(`(p.title ILIKE $${values.length} OR p.description ILIKE $${values.length})`);
    }
    if (categoryFilter) {
        values.push(categoryFilter);
        conditions.push(`c.name = $${values.length}`);
    }
    if (school) {
        values.push(school);
        conditions.push(`u.school = $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    try {
        const result = await pool.query(
            `SELECT
                p.id, p.title, p.price, p.condition, p.stock, p.primary_image, p.video_url, p.created_at,
                p.rating, p.review_count,
                p.delivery_fee_on_campus, p.delivery_fee_near_campus, p.delivery_fee_far_campus,
                u.id AS seller_id, u.name AS seller_name, u.school AS seller_school,
                u.whatsapp AS seller_whatsapp, u.verified AS seller_verified,
                u.avatar_url AS seller_avatar,
                c.name AS category
             FROM products p
             JOIN users u ON u.id = p.seller_id
             LEFT JOIN categories c ON c.id = p.category_id
             ${whereClause}
             ORDER BY p.created_at DESC`,
            values
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get products error:', err);
        res.status(500).json({ error: 'Something went wrong fetching listings' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const productResult = await pool.query(
            `SELECT
                p.id, p.title, p.description, p.price, p.condition, p.stock, p.video_url, p.created_at,
                p.rating, p.review_count,
                p.delivery_fee_on_campus, p.delivery_fee_near_campus, p.delivery_fee_far_campus,
                u.id AS seller_id, u.name AS seller_name, u.school AS seller_school,
                u.whatsapp AS seller_whatsapp, u.verified AS seller_verified, u.last_active AS seller_last_active,
                u.avatar_url AS seller_avatar,
                c.name AS category
             FROM products p
             JOIN users u ON u.id = p.seller_id
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.id = $1`,
            [req.params.id]
        );

        const product = productResult.rows[0];
        if (!product) return res.status(404).json({ error: 'Listing not found' });

        const imagesResult = await pool.query(
            'SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC',
            [req.params.id]
        );

        product.images = imagesResult.rows;
        res.json(product);
    } catch (err) {
        console.error('Get product error:', err);
        res.status(500).json({ error: 'Something went wrong fetching this listing' });
    }
});

// POST /api/products — create a listing
router.post('/', requireAuth, async (req, res) => {
    const {
        title, description, price, condition, category, stock, images, video,
        delivery_fee_on_campus, delivery_fee_near_campus, delivery_fee_far_campus,
    } = req.body;

    if (!title || !price || !images || images.length === 0) {
        return res.status(400).json({ error: 'Title, price, and at least one image are required' });
    }

    try {
        const restricted = await isSellerRestricted(req.userId);
        if (restricted) {
            return res.status(403).json({
                error: 'You have an overdue platform fee balance. Pay outstanding fees in Settings to create new listings.',
            });
        }
    } catch (err) {
        console.error('Restriction check error:', err);
        return res.status(500).json({ error: 'Something went wrong checking your seller status' });
    }

    // Clamp delivery fees server-side too — never trust the client's max
    const feeOnCampus = clampFee(delivery_fee_on_campus);
    const feeNearCampus = clampFee(delivery_fee_near_campus);
    const feeFarCampus = clampFee(delivery_fee_far_campus);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let categoryId = null;
        if (category) {
            const catResult = await client.query('SELECT id FROM categories WHERE name = $1', [category]);
            categoryId = catResult.rows[0]?.id || null;
        }

        const primaryImage = images[0];
        const videoUrl = video || null;

        const productResult = await client.query(
            `INSERT INTO products
                (seller_id, title, description, price, condition, category_id, stock, primary_image, video_url,
                 delivery_fee_on_campus, delivery_fee_near_campus, delivery_fee_far_campus)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            [req.userId, title, description || null, price, condition || 'good', categoryId, stock || 1, primaryImage, videoUrl,
             feeOnCampus, feeNearCampus, feeFarCampus]
        );

        const productId = productResult.rows[0].id;

        for (let i = 0; i < images.length; i++) {
            await client.query(
                'INSERT INTO product_images (product_id, image_url, sort_order) VALUES ($1, $2, $3)',
                [productId, images[i], i]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ id: productId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create product error:', err);
        res.status(500).json({ error: 'Something went wrong creating your listing' });
    } finally {
        client.release();
    }
});

// PATCH /api/products/:id
router.patch('/:id', requireAuth, async (req, res) => {
    const {
        title, description, price, condition, category, stock,
        delivery_fee_on_campus, delivery_fee_near_campus, delivery_fee_far_campus,
    } = req.body;

    try {
        const existing = await pool.query('SELECT seller_id FROM products WHERE id = $1', [req.params.id]);
        const product = existing.rows[0];
        if (!product) return res.status(404).json({ error: 'Listing not found' });
        if (product.seller_id !== req.userId) {
            return res.status(403).json({ error: "You can't edit someone else's listing" });
        }

        let categoryId;
        if (category !== undefined) {
            const catResult = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
            categoryId = catResult.rows[0]?.id || null;
        }

        const feeOnCampus = delivery_fee_on_campus !== undefined ? clampFee(delivery_fee_on_campus) : undefined;
        const feeNearCampus = delivery_fee_near_campus !== undefined ? clampFee(delivery_fee_near_campus) : undefined;
        const feeFarCampus = delivery_fee_far_campus !== undefined ? clampFee(delivery_fee_far_campus) : undefined;

        const result = await pool.query(
            `UPDATE products SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                price = COALESCE($3, price),
                condition = COALESCE($4, condition),
                stock = COALESCE($5, stock),
                category_id = COALESCE($6, category_id),
                delivery_fee_on_campus = COALESCE($7, delivery_fee_on_campus),
                delivery_fee_near_campus = COALESCE($8, delivery_fee_near_campus),
                delivery_fee_far_campus = COALESCE($9, delivery_fee_far_campus)
             WHERE id = $10
             RETURNING *`,
            [title, description, price, condition, stock, categoryId, feeOnCampus, feeNearCampus, feeFarCampus, req.params.id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update product error:', err);
        res.status(500).json({ error: 'Something went wrong updating your listing' });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT seller_id FROM products WHERE id = $1', [req.params.id]);
        const product = result.rows[0];
        if (!product) return res.status(404).json({ error: 'Listing not found' });
        if (product.seller_id !== req.userId) {
            return res.status(403).json({ error: "You can't delete someone else's listing" });
        }

        await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.json({ message: 'Listing deleted' });
    } catch (err) {
        console.error('Delete product error:', err);
        res.status(500).json({ error: 'Something went wrong deleting your listing' });
    }
});

module.exports = router;