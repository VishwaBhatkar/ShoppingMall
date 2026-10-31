const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.use(authenticateToken, requireRole('CUSTOMER'));

router.post('/', orderController.createOrder);
router.get('/', orderController.getCustomerOrders);
router.get('/:id', orderController.getOrderDetails);
router.put('/:id/cancel', orderController.cancelOrder);

module.exports = router;
