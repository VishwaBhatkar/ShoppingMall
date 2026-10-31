const { verifyToken } = require('../utils/jwtUtils');
const { unauthorized, forbidden } = require('../utils/responseUtils');
const db = require('../config/database');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized(res, 'Authorization token is required');
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return unauthorized(res, 'Invalid or expired authorization token');
  }

  try {
    // Verify against DB to ensure user is active and exists
    const [users] = await db.query(
      'SELECT id, email, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!users || users.length === 0) {
      // In case admin is strictly hardcoded in config without DB user id 1
      if (decoded.role === 'ADMIN' && decoded.email === (process.env.ADMIN_EMAIL || 'admin@shoppingmall.com')) {
        req.user = {
          userId: decoded.userId || 1,
          email: decoded.email,
          role: 'ADMIN'
        };
        return next();
      }
      return unauthorized(res, 'User account no longer exists');
    }

    const user = users[0];
    if (!user.is_active) {
      return forbidden(res, 'Account has been deactivated. Please contact support.');
    }

    // Role-specific ID attachment
    let customerId = null;
    let sellerId = null;
    let sellerStatus = null;

    if (user.role === 'CUSTOMER') {
      const [customers] = await db.query('SELECT id FROM customers WHERE user_id = ?', [user.id]);
      if (customers.length > 0) customerId = customers[0].id;
    } else if (user.role === 'SELLER') {
      const [sellers] = await db.query('SELECT id, approval_status FROM sellers WHERE user_id = ?', [user.id]);
      if (sellers.length > 0) {
        sellerId = sellers[0].id;
        sellerStatus = sellers[0].approval_status;
      }
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      customerId,
      sellerId,
      sellerStatus
    };

    next();
  } catch (error) {
    console.error('[AuthMiddleware] Error verifying user:', error.message);
    // If DB is temporarily unavailable, fall back to decoded token for robustness
    req.user = decoded;
    next();
  }
}

module.exports = {
  authenticateToken
};
