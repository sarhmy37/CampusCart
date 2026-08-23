require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');

const productRoutes = require('./routes/products');

const categoryRoutes = require('./routes/categories');

const orderRoutes = require('./routes/orders');

const wishlistRoutes = require('./routes/wishlist');

const sellerRoutes = require('./routes/sellers');

const notificationRoutes = require('./routes/notifications');

const adminRoutes = require('./routes/admin');

const adminAuthRoutes = require('./routes/adminAuth');

const payoutRoutes = require('./routes/payouts');

const reportRoutes = require('./routes/reports');

const reviewRoutes = require('./routes/reviews');

const chatRoutes = require('./routes/chat');

const app = express();

const rawOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
const corsOrigin = rawOrigins.includes('*') || rawOrigins.length === 0 ? '*' : rawOrigins;

app.use(cors({
    origin: corsOrigin,
}));
app.use(express.json({
    verify: (req, res, buf) => { req.rawBody = buf; },
}));

// Serve uploaded avatar/product images
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve static site imagery/video (hero photos, campus gallery, promo videos)
app.use('/media', express.static(path.join(__dirname, '..', 'media')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);

app.use('/api/products', productRoutes);

app.use('/api/categories', categoryRoutes);

app.use('/api/admin/auth', adminAuthRoutes);

app.use('/api/orders', orderRoutes);

app.use('/api/reports', reportRoutes);

app.use('/api/wishlist', wishlistRoutes);

app.use('/api/sellers', sellerRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/notifications', notificationRoutes);

app.use('/api/payouts', payoutRoutes);

app.use('/api/reviews', reviewRoutes);

app.use('/api/chat', chatRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Basic error handler (e.g. multer file-size/type errors land here)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusCart API running on http://localhost:${PORT}`);
    console.log(`CampusCart API running on network: http://0.0.0.0:${PORT}`);
});