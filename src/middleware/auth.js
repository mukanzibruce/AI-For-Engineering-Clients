const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'cynea-platform-secret';

function generateToken(payload, rememberMe = false) {
  return jwt.sign(payload, SECRET, { expiresIn: rememberMe ? '7d' : '24h' });
}

function decodeTokenUnsafe(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}

function verifyTokenAllowExpired(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const decoded = jwt.decode(token);
      if (decoded) {
        const expiredAgo = Date.now() / 1000 - decoded.exp;
        if (expiredAgo < 3600) return decoded; // allow refresh within 1 hour of expiry
      }
    }
    return null;
  }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { generateToken, decodeTokenUnsafe, verifyTokenAllowExpired, authMiddleware, requireRole };
