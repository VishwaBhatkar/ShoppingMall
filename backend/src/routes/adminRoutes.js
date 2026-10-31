const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// All admin endpoints require ADMIN role
router.use(authenticateToken, requireRole('ADMIN'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Customers
router.get('/customers', adminController.getCustomers);
router.put('/customers/:id/status', adminController.updateCustomerStatus);
router.delete('/customers/:id', adminController.deleteCustomer);

// Sellers & Approvals
router.get('/sellers', adminController.getSellers);
router.put('/sellers/:id/approve', adminController.approveSeller);
router.put('/sellers/:id/reject', adminController.rejectSeller);
router.put('/sellers/:id/status', adminController.updateSellerStatus);

// Products
router.get('/products', adminController.getProducts);
router.put('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Orders
router.get('/orders', adminController.getOrders);

// Categories
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Reports
router.get('/reports', adminController.getReports);

// Profile
router.get('/profile', adminController.getProfile);
router.put('/change-password', adminController.changePassword);

module.exports = router;
