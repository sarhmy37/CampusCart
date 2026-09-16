const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Attaches req.userId and req.userRole if valid token, and enforces single-session
async function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        const result = await pool.query(
            'SELECT id, name, university_email, school, account_type, role, verified, avatar_url, session_id FROM users WHERE id = $1',
            [payload.userId]
        );
        const dbUser = result.rows[0];

        if (!dbUser) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Session mismatch = a newer login (or a logout) replaced this token's
        // session — reject even though the JWT itself is still cryptographically valid.
        if (dbUser.session_id !== payload.sessionId) {
            return res.status(401).json({ error: 'You were signed out because your account was accessed on another device', code: 'SESSION_REVOKED' });
        }

        req.userId = payload.userId;
        req.userRole = payload.role;
        req.user = dbUser;

        pool.query('UPDATE users SET last_active = now() WHERE id = $1', [req.userId]).catch((err) => {
            console.error('last_active update error:', err.message);
        });

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

// Like requireAuth, but never blocks the request — if there's no token or
// it's invalid/expired, req.userId simply stays unset and the request
// continues as anonymous. Use on routes that behave differently for
// logged-in vs anonymous users without requiring login.
function optionalAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) return next();

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = payload.userId;
        req.userRole = payload.role;
    } catch (err) {
        // invalid/expired token — treat as anonymous rather than blocking
    }
    next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };