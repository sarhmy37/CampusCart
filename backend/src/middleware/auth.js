const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Attaches req.userId and req.userRole if valid token
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = payload.userId;
        req.userRole = payload.role;
        req.user = { id: payload.userId, role: payload.role }; // ✅ Fallback user object

        // Fetch full user object from database (fire-and-forget)
        pool.query(
            'SELECT id, name, university_email, school, account_type, role, verified, avatar_url FROM users WHERE id = $1',
            [req.userId]
        ).then((result) => {
            if (result.rows.length > 0) {
                req.user = result.rows[0];
            }
            pool.query('UPDATE users SET last_active_at = now() WHERE id = $1', [req.userId]).catch(() => {});
        }).catch(() => {});

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Use after requireAuth — blocks non-admins.
function requireAdmin(req, res, next) {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

module.exports = { requireAuth, requireAdmin };