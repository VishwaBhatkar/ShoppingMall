const { forbidden } = require('../utils/responseUtils');
const db = require('../config/database');

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return forbidden(res, 'Authentication required for this operation');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return forbidden(
        res,
        `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
      );
    }

    next();
  };
}

async function requireApprovedSeller(req, res, next) {
  if (!req.user || req.user.role !== 'SELLER') {
    return forbidden(res, 'Access restricted to sellers only');
  }

  try {
    const [sellers] = await db.query(
      'SELECT id, approval_status, rejection_reason FROM sellers WHERE user_id = ?',
      [req.user.userId]
    );

    if (!sellers || sellers.length === 0) {
      return forbidden(res, 'Seller profile not found');
    }

    const seller = sellers[0];
    req.user.sellerId = seller.id;
    req.user.sellerStatus = seller.approval_status;

    if (seller.approval_status === 'PENDING') {
      return forbidden(
        res,
        'Your seller registration is currently PENDING approval from the administrator. You will be able to access the seller dashboard once approved.'
      );
    }

    if (seller.approval_status === 'REJECTED') {
      return forbidden(
        res,
        `Your seller registration was REJECTED by the administrator. Reason: ${seller.rejection_reason || 'Does not meet criteria'}`
      );
    }

    if (seller.approval_status === 'SUSPENDED') {
      return forbidden(
        res,
        'Your seller account is currently SUSPENDED. Please contact administrator support.'
      );
    }

    if (seller.approval_status !== 'APPROVED') {
      return forbidden(res, 'Seller account is not approved');
    }

    next();
  } catch (error) {
    console.error('[RoleMiddleware] Seller check error:', error.message);
    if (req.user.sellerStatus === 'APPROVED') {
      return next();
    }
    return forbidden(res, 'Seller verification error. Please ensure account is approved.');
  }
}

module.exports = {
  requireRole,
  requireApprovedSeller
};
