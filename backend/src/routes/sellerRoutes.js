const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole, requireApprovedSeller } = require('../middleware/roleMiddleware');
const { validateProduct } = require('../validators/authValidators');
const upload = require('../middleware/uploadMiddleware');

// All seller endpoints require SELLER role and APPROVED status
router.use(authenticateToken, requireRole('SELLER'), requireApprovedSeller);

// Dashboard
router.get('/dashboard', sellerController.getDashboard);

// Products
router.get('/products', sellerController.getProducts);
router.post('/products', upload.single('image'), validateProduct, sellerController.createProduct);
router.put('/products/:id', upload.single('image'), sellerController.updateProduct);
router.delete('/products/:id', sellerController.deleteProduct);

// Orders
router.get('/orders', sellerController.getOrders);
router.put('/orders/:id/status', sellerController.updateOrderStatus);

// Sales
router.get('/sales', sellerController.getSales);

// Profile
router.get('/profile', sellerController.getProfile);
router.put('/profile', sellerController.updateProfile);

module.exports = router;
