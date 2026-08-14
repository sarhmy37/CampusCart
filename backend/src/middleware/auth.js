const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Attaches req.userId if a valid token is present. Rejects with 401 otherwise.
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

        // Fire-and-forget — don't hold up the response waiting on this.
        pool.query('UPDATE users SET last_active = now() WHERE id = $1', [req.userId]).catch(() => {});

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