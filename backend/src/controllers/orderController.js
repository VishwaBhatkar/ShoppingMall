const db = require('../config/database');
const { success, badRequest, notFound, forbidden } = require('../utils/responseUtils');

// Helper to generate unique order number
function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${randomStr}`;
}

// POST /api/orders (Create Order with DB Transaction)
exports.createOrder = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const userId = req.user.userId;
    const { shippingAddressId, paymentMethod = 'COD', paymentDetails = null } = req.body;

    if (!shippingAddressId) {
      return badRequest(res, 'Delivery shipping address is required');
    }

    const validPaymentMethods = ['COD', 'SIMULATED_CARD', 'SIMULATED_UPI', 'SIMULATED_NETBANKING'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return badRequest(res, `Invalid payment method. Choose from: ${validPaymentMethods.join(', ')}`);
    }

    // 1. Fetch Shipping Address
    const [addresses] = await db.query(
      'SELECT * FROM addresses WHERE id = ? AND customer_id = ?',
      [shippingAddressId, customerId]
    );
    if (addresses.length === 0) {
      return badRequest(res, 'Selected delivery address not found');
    }
    const addr = addresses[0];
    const addressText = `${addr.recipient_name}, ${addr.street_address}, ${addr.city}, ${addr.state} ${addr.postal_code}, ${addr.country} (Ph: ${addr.phone_number})`;

    // 2. Run transactional order creation
    const orderResult = await db.withTransaction(async (conn) => {
      // Find cart
      const [carts] = await conn.query('SELECT id FROM carts WHERE customer_id = ?', [customerId]);
      if (carts.length === 0) throw new Error('Cart not found');
      const cartId = carts[0].id;

      // Lock & fetch cart items with current product stock
      const [items] = await conn.query(
        `SELECT ci.id AS cart_item_id, ci.quantity, 
                p.id AS product_id, p.name AS product_name, p.price, p.discount_percent, 
                p.stock_quantity, p.seller_id, p.is_active
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
         WHERE ci.cart_id = ?
         FOR UPDATE`,
        [cartId]
      );

      if (items.length === 0) {
        throw new Error('Your cart is empty. Add products before checkout.');
      }

      // Check stock for all items
      let subtotal = 0;
      const orderItemsToInsert = [];

      for (const item of items) {
        if (!item.is_active) {
          throw new Error(`Product "${item.product_name}" is no longer active.`);
        }
        if (item.quantity > item.stock_quantity) {
          throw new Error(`Product "${item.product_name}" only has ${item.stock_quantity} in stock.`);
        }

        const discount = parseFloat(item.discount_percent || 0);
        const originalPrice = parseFloat(item.price);
        const unitPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
        const lineTotal = parseFloat((unitPrice * item.quantity).toFixed(2));
        subtotal += lineTotal;

        orderItemsToInsert.push({
          productId: item.product_id,
          sellerId: item.seller_id,
          productName: item.product_name,
          unitPrice: parseFloat(unitPrice.toFixed(2)),
          quantity: item.quantity,
          totalPrice: lineTotal
        });
      }

      const tax = parseFloat((subtotal * 0.08).toFixed(2));
      const shippingFee = subtotal > 50 ? 0.0 : 5.0;
      const totalAmount = parseFloat((subtotal + tax + shippingFee).toFixed(2));
      const orderNumber = generateOrderNumber();

      // Insert Order
      const [orderRes] = await conn.query(
        `INSERT INTO orders 
         (order_number, customer_id, shipping_address_id, shipping_address_text, subtotal, tax, shipping_fee, total_amount, order_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [orderNumber, customerId, addr.id, addressText, subtotal, tax, shippingFee, totalAmount]
      );
      const orderId = orderRes.insertId;

      // Insert Order Items and Update Inventory
      for (const oi of orderItemsToInsert) {
        await conn.query(
          `INSERT INTO order_items 
           (order_id, product_id, seller_id, product_name, unit_price, quantity, total_price, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
          [orderId, oi.productId, oi.sellerId, oi.productName, oi.unitPrice, oi.quantity, oi.totalPrice]
        );

        // Deduct inventory
        await conn.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [oi.quantity, oi.productId]
        );

        // Record inventory transaction
        await conn.query(
          `INSERT INTO inventory_transactions 
           (product_id, change_quantity, reason, reference_order_id, notes)
           VALUES (?, ?, 'ORDER_RESERVED', ?, ?)`,
          [oi.productId, -oi.quantity, orderId, `Reserved for order ${orderNumber}`]
        );

        // Notify seller
        await conn.query(
          `INSERT INTO notifications (user_id, title, message)
           SELECT s.user_id, 'New Order Received', ?
           FROM sellers s WHERE s.id = ?`,
          [`You have a new order ${orderNumber} for product "${oi.productName}".`, oi.sellerId]
        );
      }

      // Record Payment
      const paymentStatus = paymentMethod === 'COD' ? 'PENDING' : 'COMPLETED';
      const txnRef = `${paymentMethod.slice(0, 3)}-TXN-${Date.now().toString().slice(-8)}`;
      const noteDetails = paymentMethod === 'COD' 
        ? 'Cash on Delivery: Payment will be collected upon delivery' 
        : `Simulated Payment via ${paymentMethod} (Transaction ID: ${txnRef} - Test simulation only)`;

      await conn.query(
        `INSERT INTO payments 
         (order_id, payment_method, payment_status, transaction_reference, amount, payment_details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, paymentMethod, paymentStatus, txnRef, totalAmount, noteDetails]
      );

      // Record Order History
      await conn.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_user_id, notes)
         VALUES (?, NULL, 'PENDING', ?, 'Order successfully created and placed by customer')`,
        [orderId, userId]
      );

      // Clear Cart
      await conn.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

      // Notify Customer
      await conn.query(
        `INSERT INTO notifications (user_id, title, message)
         VALUES (?, 'Order Placed Successfully', ?)`,
        [userId, `Your order ${orderNumber} for $${totalAmount.toFixed(2)} has been confirmed!`]
      );

      return {
        orderId,
        orderNumber,
        totalAmount,
        subtotal,
        tax,
        shippingFee,
        orderStatus: 'PENDING',
        paymentMethod,
        paymentStatus,
        transactionReference: txnRef
      };
    });

    return success(res, 'Order created successfully!', orderResult, 201);
  } catch (err) {
    if (err.message && err.message.includes('stock')) {
      return badRequest(res, err.message);
    }
    next(err);
  }
};

// GET /api/orders (Customer Order History)
exports.getCustomerOrders = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;

    const [orders] = await db.query(
      `SELECT o.*, 
              p.payment_method, p.payment_status, p.transaction_reference,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS total_items
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC`,
      [customerId]
    );

    if (orders.length === 0) {
      return success(res, 'Orders fetched', []);
    }

    const orderIds = orders.map((o) => o.id);
    const [items] = await db.query(
      `SELECT oi.*, 
              (SELECT image_url FROM product_images WHERE product_id = oi.product_id ORDER BY is_primary DESC, id ASC LIMIT 1) AS product_image
       FROM order_items oi
       WHERE oi.order_id IN (?)`,
      [orderIds]
    );

    const itemsMap = {};
    items.forEach((item) => {
      if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
      itemsMap[item.order_id].push(item);
    });

    const enrichedOrders = orders.map((o) => ({
      ...o,
      items: itemsMap[o.id] || []
    }));

    return success(res, 'Orders fetched successfully', enrichedOrders);
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:id (Customer Order Details)
exports.getOrderDetails = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const orderId = req.params.id;

    const [orders] = await db.query(
      `SELECT o.*, p.payment_method, p.payment_status, p.transaction_reference, p.payment_details
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.id = ? AND o.customer_id = ?`,
      [orderId, customerId]
    );

    if (orders.length === 0) {
      return notFound(res, 'Order not found');
    }

    const order = orders[0];

    // Fetch items
    const [items] = await db.query(
      `SELECT oi.*, s.business_name AS seller_name,
              (SELECT image_url FROM product_images WHERE product_id = oi.product_id ORDER BY is_primary DESC, id ASC LIMIT 1) AS product_image
       FROM order_items oi
       JOIN sellers s ON s.id = oi.seller_id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    // Fetch status history
    const [history] = await db.query(
      `SELECT h.*, u.email AS changed_by_email, u.role AS changed_by_role
       FROM order_status_history h
       LEFT JOIN users u ON u.id = h.changed_by_user_id
       WHERE h.order_id = ?
       ORDER BY h.created_at ASC`,
      [orderId]
    );

    order.items = items;
    order.status_history = history;

    return success(res, 'Order details fetched', order);
  } catch (err) {
    next(err);
  }
};

// PUT /api/orders/:id/cancel (Customer Order Cancellation)
exports.cancelOrder = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const userId = req.user.userId;
    const orderId = req.params.id;
    const { reason = 'Cancelled by customer' } = req.body;

    const [orders] = await db.query(
      'SELECT id, order_number, order_status FROM orders WHERE id = ? AND customer_id = ?',
      [orderId, customerId]
    );

    if (orders.length === 0) {
      return notFound(res, 'Order not found');
    }

    const order = orders[0];

    // Only PENDING or CONFIRMED orders can be cancelled by customer
    if (!['PENDING', 'CONFIRMED'].includes(order.order_status)) {
      return badRequest(
        res,
        `Cannot cancel order with status "${order.order_status}". Orders that are already processed or shipped cannot be cancelled directly.`
      );
    }

    await db.withTransaction(async (conn) => {
      // 1. Update order status
      await conn.query(
        'UPDATE orders SET order_status = ?, cancellation_reason = ? WHERE id = ?',
        ['CANCELLED', reason, orderId]
      );

      // 2. Update order_items status
      await conn.query('UPDATE order_items SET status = ? WHERE order_id = ?', ['CANCELLED', orderId]);

      // 3. Fetch items to restore inventory
      const [items] = await conn.query(
        'SELECT product_id, seller_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );

      for (const item of items) {
        // Restore product stock
        await conn.query(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );

        // Record inventory return
        await conn.query(
          `INSERT INTO inventory_transactions (product_id, change_quantity, reason, reference_order_id, notes)
           VALUES (?, ?, 'ORDER_CANCELLED', ?, ?)`,
          [item.product_id, item.quantity, orderId, `Stock restored due to cancellation of order ${order.order_number}`]
        );

        // Notify seller
        await conn.query(
          `INSERT INTO notifications (user_id, title, message)
           SELECT s.user_id, 'Order Cancelled', ?
           FROM sellers s WHERE s.id = ?`,
          [`Order ${order.order_number} has been cancelled by customer. Restocked ${item.quantity} item(s).`, item.seller_id]
        );
      }

      // 4. Update payment status if needed
      await conn.query(
        'UPDATE payments SET payment_status = ? WHERE order_id = ? AND payment_status = ?',
        ['REFUNDED', orderId, 'COMPLETED']
      );

      // 5. Record status history
      await conn.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_user_id, notes)
         VALUES (?, ?, 'CANCELLED', ?, ?)`,
        [orderId, order.order_status, userId, `Order cancelled by customer. Reason: ${reason}`]
      );
    });

    return success(res, 'Order cancelled successfully and inventory restored');
  } catch (err) {
    next(err);
  }
};
