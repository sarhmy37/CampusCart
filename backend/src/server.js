require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const productRoutes = require('./routes/products');

const categoryRoutes = require('./routes/categories');

const orderRoutes = require('./routes/orders');

const wishlistRoutes = require('./routes/wishlist');

const sellerRoutes = require('./routes/sellers');

const authRoutes = require('./routes/auth');

const payoutRoutes = require('./routes/payouts');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : '*',
    credentials: true,
}));
app.use(express.json({
    verify: (req, res, buf) => { req.rawBody = buf; },
}));

// Serve uploaded avatar/product images
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);

app.use('/api/products', productRoutes);

app.use('/api/categories', categoryRoutes);

app.use('/api/orders', orderRoutes);

app.use('/api/wishlist', wishlistRoutes);

app.use('/api/sellers', sellerRoutes);

app.use('/api/payouts', payoutRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Basic error handler (e.g. multer file-size/type errors land here)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`CampusCart API running on http://localhost:${PORT}`);
});