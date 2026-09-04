const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/seller/:sellerId — reviews for a seller, with like/comment data
router.get('/seller/:sellerId', async (req, res) => {
    const { sellerId } = req.params;
    const viewerId = req.userId; // may be undefined if not logged in (route isn't auth-gated)

    try {
        const reviewsResult = await pool.query(
            `SELECT r.*, 
                    (SELECT COUNT(*) FROM review_likes WHERE review_id = r.id) AS like_count
             FROM reviews r
             WHERE r.seller_id = $1
             ORDER BY r.created_at DESC`,
            [sellerId]
        );
        const reviews = reviewsResult.rows;

        for (const review of reviews) {
            const commentsResult = await pool.query(
                'SELECT id, commenter_name, content, created_at FROM review_comments WHERE review_id = $1 ORDER BY created_at ASC',
                [review.id]
            );
            review.comments = commentsResult.rows;

            if (viewerId) {
                const likedResult = await pool.query(
                    'SELECT 1 FROM review_likes WHERE review_id = $1 AND user_id = $2',
                    [review.id, viewerId]
                );
                review.liked_by_me = likedResult.rows.length > 0;
            } else {
                review.liked_by_me = false;
            }
        }

        const ratings = reviews.map((r) => r.rating);
        const avg_rating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;

        res.json({ reviews, avg_rating, total: reviews.length });
    } catch (err) {
        console.error('Get seller reviews error:', err);
        res.status(500).json({ error: 'Something went wrong fetching reviews' });
    }
});

// GET /api/reviews/pending-sellers — distinct sellers this buyer has completed a
// purchase from, hasn't reviewed, and hasn't permanently skipped. Used to drive
// the post-purchase review prompt queue.
router.get('/pending-sellers', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT u.id AS seller_id, u.name AS seller_name, u.avatar_url AS seller_avatar
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             JOIN users u ON u.id = oi.seller_id
             WHERE o.buyer_id = $1
               AND oi.status = 'completed'
               AND NOT EXISTS (
                   SELECT 1 FROM reviews r WHERE r.seller_id = oi.seller_id AND r.reviewer_id = $1
               )
               AND NOT EXISTS (
                   SELECT 1 FROM review_skips rs WHERE rs.seller_id = oi.seller_id AND rs.buyer_id = $1
               )
             ORDER BY u.name ASC`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get pending sellers error:', err);
        res.status(500).json({ error: 'Something went wrong checking pending reviews' });
    }
});

// POST /api/reviews/:sellerId/skip — permanently dismiss the review prompt for this seller
router.post('/:sellerId/skip', requireAuth, async (req, res) => {
    const { sellerId } = req.params;
    try {
        await pool.query(
            `INSERT INTO review_skips (buyer_id, seller_id) VALUES ($1, $2)
             ON CONFLICT (buyer_id, seller_id) DO NOTHING`,
            [req.userId, sellerId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Skip review error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// GET /api/reviews/can-review/:sellerId — has this buyer completed a purchase from this seller, and not already reviewed?
router.get('/can-review/:sellerId', requireAuth, async (req, res) => {
    const { sellerId } = req.params;

    try {
        const purchaseResult = await pool.query(
            `SELECT 1 FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = $1 AND o.buyer_id = $2 AND oi.status = 'completed'
             LIMIT 1`,
            [sellerId, req.userId]
        );
        const hasPurchased = purchaseResult.rows.length > 0;

        const existingReview = await pool.query(
            'SELECT 1 FROM reviews WHERE seller_id = $1 AND reviewer_id = $2',
            [sellerId, req.userId]
        );
        const alreadyReviewed = existingReview.rows.length > 0;

        res.json({ can_review: hasPurchased && !alreadyReviewed, has_purchased: hasPurchased, already_reviewed: alreadyReviewed });
    } catch (err) {
        console.error('Can-review check error:', err);
        res.status(500).json({ error: 'Something went wrong checking review eligibility' });
    }
});

// POST /api/reviews — create a review (only after a completed purchase from that seller)
router.post('/', requireAuth, async (req, res) => {
    const { seller_id, rating, comment } = req.body;

    if (!seller_id || !rating) {
        return res.status(400).json({ error: 'seller_id and rating are required' });
    }
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
        const purchaseResult = await pool.query(
            `SELECT 1 FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.seller_id = $1 AND o.buyer_id = $2 AND oi.status = 'completed'
             LIMIT 1`,
            [seller_id, req.userId]
        );
        if (purchaseResult.rows.length === 0) {
            return res.status(403).json({ error: 'You can only review sellers you\'ve completed a purchase from' });
        }

        const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [req.userId]);
        const reviewerName = userResult.rows[0]?.name || 'Anonymous';

        const result = await pool.query(
            `INSERT INTO reviews (seller_id, reviewer_id, reviewer_name, rating, comment)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [seller_id, req.userId, reviewerName, rating, comment || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'You\'ve already reviewed this seller' });
        }
        console.error('Create review error:', err);
        res.status(500).json({ error: 'Something went wrong submitting your review' });
    }
});

// POST /api/reviews/:id/like — toggle like on a review
router.post('/:id/like', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const existing = await pool.query(
            'SELECT id FROM review_likes WHERE review_id = $1 AND user_id = $2',
            [id, req.userId]
        );

        if (existing.rows.length > 0) {
            await pool.query('DELETE FROM review_likes WHERE review_id = $1 AND user_id = $2', [id, req.userId]);
        } else {
            await pool.query('INSERT INTO review_likes (review_id, user_id) VALUES ($1, $2)', [id, req.userId]);
        }

        const countResult = await pool.query('SELECT COUNT(*) FROM review_likes WHERE review_id = $1', [id]);
        res.json({ like_count: parseInt(countResult.rows[0].count, 10), liked_by_me: existing.rows.length === 0 });
    } catch (err) {
        console.error('Toggle like error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// POST /api/reviews/:id/comments — add a comment to a review
router.post('/:id/comments', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    try {
        const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [req.userId]);
        const commenterName = userResult.rows[0]?.name || 'Anonymous';

        const result = await pool.query(
            `INSERT INTO review_comments (review_id, commenter_id, commenter_name, content)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, req.userId, commenterName, content.trim()]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Add comment error:', err);
        res.status(500).json({ error: 'Something went wrong adding your comment' });
    }
});

// GET /api/reviews/product/:productId — fetch reviews for a product
router.get('/product/:productId', async (req, res) => {
    const { productId } = req.params;
    const viewerId = req.userId; // optional

    try {
        const reviewsResult = await pool.query(
            `SELECT pr.*, u.name AS reviewer_name
             FROM product_reviews pr
             JOIN users u ON u.id = pr.user_id
             WHERE pr.product_id = $1
             ORDER BY pr.created_at DESC`,
            [productId]
        );
        const reviews = reviewsResult.rows;

        // Optionally check if viewer liked? Not needed for now.

        const ratings = reviews.map((r) => r.rating);
        const avg_rating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;

        res.json({ reviews, avg_rating, total: reviews.length });
    } catch (err) {
        console.error('Get product reviews error:', err);
        res.status(500).json({ error: 'Failed to fetch product reviews' });
    }
});

// POST /api/reviews/product — submit a review for a product (only if purchased)
router.post('/product', requireAuth, async (req, res) => {
    const { product_id, rating, comment } = req.body;

    if (!product_id || !rating) {
        return res.status(400).json({ error: 'product_id and rating are required' });
    }
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const client = await pool.connect();
    try {
        // Check if the user has purchased this product (order completed)
        const purchaseResult = await client.query(
            `SELECT 1 FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.product_id = $1 AND o.buyer_id = $2 AND oi.status = 'completed'
             LIMIT 1`,
            [product_id, req.userId]
        );
        if (purchaseResult.rows.length === 0) {
            return res.status(403).json({ error: 'You can only review products you have purchased and received.' });
        }

        // Check if already reviewed
        const existing = await client.query(
            'SELECT id FROM product_reviews WHERE product_id = $1 AND user_id = $2',
            [product_id, req.userId]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'You have already reviewed this product.' });
        }

        await client.query('BEGIN');

        // Insert review
        const result = await client.query(
            `INSERT INTO product_reviews (product_id, user_id, rating, comment)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [product_id, req.userId, rating, comment || null]
        );

        // Update product rating and review_count
        await client.query(
            `UPDATE products
             SET rating = (
                 SELECT COALESCE(AVG(rating), 0) FROM product_reviews WHERE product_id = $1
             ),
             review_count = (
                 SELECT COUNT(*) FROM product_reviews WHERE product_id = $1
             )
             WHERE id = $1`,
            [product_id]
        );

        await client.query('COMMIT');

        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create product review error:', err);
        res.status(500).json({ error: 'Failed to submit review' });
    } finally {
        client.release();
    }
});

module.exports = router;