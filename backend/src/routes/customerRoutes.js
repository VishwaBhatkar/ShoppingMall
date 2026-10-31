const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All customer routes require authenticated CUSTOMER role
router.use(authenticateToken, requireRole('CUSTOMER'));

// Profile
router.get('/profile', customerController.getProfile);
router.put('/profile', customerController.updateProfile);
router.put('/change-password', customerController.changePassword);

// Delivery Addresses
router.get('/addresses', customerController.getAddresses);
router.post('/addresses', customerController.addAddress);
router.put('/addresses/:id', customerController.updateAddress);
router.delete('/addresses/:id', customerController.deleteAddress);

module.exports = router;
