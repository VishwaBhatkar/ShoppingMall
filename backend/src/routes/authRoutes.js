const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  validateCustomerRegister,
  validateCustomerLogin,
  validateSellerRegister,
  validateSellerLogin,
  validateAdminLogin
} = require('../validators/authValidators');

// Customer Auth
router.post('/customer/register', validateCustomerRegister, authController.customerRegister);
router.post('/customer/login', validateCustomerLogin, authController.customerLogin);

// Seller Auth
router.post('/seller/register', validateSellerRegister, authController.sellerRegister);
router.post('/seller/login', validateSellerLogin, authController.sellerLogin);

// Admin Auth (Protected hardcoded / backend config)
router.post('/admin/login', validateAdminLogin, authController.adminLogin);

// Common User Info & Password recovery
router.get('/me', authenticateToken, authController.getMe);
router.post('/logout', authenticateToken, authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
