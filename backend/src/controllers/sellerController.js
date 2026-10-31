const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { success, badRequest, notFound, forbidden } = require('../utils/responseUtils');

// Helper to get verified seller ID
async function getSellerIdFromUser(userId) {
  const [rows] = await db.query('SELECT id, approval_status FROM sellers WHERE user_id = ?', [userId]);
  if (rows.length === 0) return null;
  return rows[0].id;
}

// GET /api/seller/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const sellerId = req.user.sellerId || (await getSellerIdFromUser(req.user.userId));
    if (!sellerId) return forbidden(res, 'Seller profile not found');

    // 1. Total products & total inventory count
    const [prodStats] = await db.query(
      `SELECT COUNT(*) AS total_products, 
              COALESCE(SUM(stock_quantity), 0) AS total_inventory,
              COUNT(CASE WHEN stock_quantity <= 10 THEN 1 END) AS low_stock_count
       FROM products 
       WHERE seller_id = ? AND is_active = TRUE`,
      [sellerId]
    );

    // 2. Order statistics for this seller's products
    const [orderStats] = await db.query(
      `SELECT COUNT(DISTINCT oi.order_id) AS total_orders,
              COUNT(DISTINCT CASE WHEN oi.status = 'PENDING' THEN oi.order_id END) AS pending_orders,
              COUNT(DISTINCT CASE WHEN oi.status = 'DELIVERED' THEN oi.order_id END) AS completed_orders,
              COALESCE(SUM(CASE WHEN oi.status != 'CANCELLED' THEN oi.total_price ELSE 0 END), 0) AS total_sales
       FROM order_items oi
       WHERE oi.seller_id = ?`,
      [sellerId]
    );

    // 3. Low stock products alert list
    const [lowStockProducts] = await db.query(
      `SELECT id, name, sku, stock_quantity, price 
       FROM products 
       WHERE seller_id = ? AND stock_quantity <= 10 AND is_active = TRUE
       ORDER BY stock_quantity ASC LIMIT 5`,
      [sellerId]
    );

    // 4. Recent orders
    const [recentOrders] = await db.query(
      `SELECT oi.id, oi.order_id, oi.product_name, oi.quantity, oi.total_price, oi.status, oi.created_at,
              o.order_number, o.shipping_address_text
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.seller_id = ?
       ORDER BY oi.created_at DESC LIMIT 5`,
      [sellerId]
    );

    return success(res, 'Seller dashboard data retrieved', {
      totalProducts: prodStats[0].total_products,
      totalInventory: prodStats[0].total_inventory,
      lowStockCount: prodStats[0].low_stock_count,
      totalOrders: orderStats[0].total_orders,
      pendingOrders: orderStats[0].pending_orders,
      completedOrders: orderStats[0].completed_orders,
      totalSales: parseFloat(orderStats[0].total_sales || 0),
      lowStockProducts,
      recentOrders
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/seller/products (Seller's products)
exports.getProducts = async (req, res, next) => {
  try {
    const sellerId = req.user.sellerId || (await getSellerIdFromUser(req.user.userId));
    if (!sellerId) return forbidden(res, 'Seller profile not found');

    const [products] = await db.query(
      `SELECT p.*, c.name AS category_name,
              (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) AS primary_image
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.seller_id = ?
       ORDER BY p.created_at DESC`,
      [sellerId]
    );

    return success(res, 'Seller products fetched', products);
  } catch (err) {
    next(err);
  }
};

// POST /api/seller/products (Add product)
exports.createProduct = async (req, res, next) => {
  try {
    const sellerId = req.user.sellerId || (await getSellerIdFromUser(req.user.userId));
    if (!sellerId) return forbidden(res, 'Seller profile not found');

    const {
      name,
      description,
      categoryId,
      price,
      discountPercent = 0,
      stockQuantity = 0,
      sku,
      imageUrl,
      isFeatured = false
    } = req.body;

    // Check unique SKU
    const [existingSku] = await db.query('SELECT id FROM products WHERE sku = ?', [sku.trim()]);
    if (existingSku.length > 0) {
      return badRequest(res, 'A product with this SKU already exists');
    }

    const result = await db.withTransaction(async (conn) => {
      const [prodRes] = await conn.query(
        `INSERT INTO products 
         (seller_id, category_id, name, description, price, discount_percent, stock_quantity, sku, is_featured, is_active, is_approved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
        [
          sellerId,
          categoryId,
          name.trim(),
          description.trim(),
          parseFloat(price),
          parseFloat(discountPercent || 0),
          parseInt(stockQuantity, 10),
          sku.trim(),
          !!isFeatured
        ]
      );
      const productId = prodRes.insertId;

      // Primary image if provided or uploaded
      let finalImg = imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800';
      if (req.file) {
        finalImg = `/uploads/${req.file.filename}`;
      }

      await conn.query(
        'INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, TRUE)',
        [productId, finalImg]
      );

      // Record initial stock transaction
      if (parseInt(stockQuantity, 10) > 0) {
        await conn.query(
          `INSERT INTO inventory_transactions (product_id, change_quantity, reason, notes)
           VALUES (?, ?, 'RESTOCK', 'Initial stock entry on product creation')`,
          [productId, parseInt(stockQuantity, 10)]
        );
      }

      return { productId, name, price, stockQuantity, sku, primary_image: finalImg };
    });

    return success(res, 'Product created successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

// PUT /api/seller/products/:id (Edit product)
exports.updateProduct = async (req, res, next) => {
  try {
    const sellerId = req.user.sellerId || (await getSellerIdFromUser(req.user.userId));
    const productId = req.params.id;

    // Ownership check
    const [existing] = await db.query(
      'SELECT id, stock_quantity FROM products WHERE id = ? AND seller_id = ?',
      [productId, sellerId]
    );

    if (existing.length === 0) {
      return forbidden(res, 'You do not have permission to edit this product or it does not exist');
    }

    const {
      name,
      description,
      categoryId,
      price,
      discountPercent,
      stockQuantity,
      sku,
      isActive,
      isFeatured,
      imageUrl
    } = req.body;

    const oldStock = existing[0].stock_quantity;
    const newStock = stockQuantity !== undefined ? parseInt(stockQuantity, 10) : oldStock;

    await db.withTransaction(async (conn) => {
      await conn.query(
        `UPDATE products 
         SET name = COALESCE(?, name),
             description = COALESCE(?, description),
             category_id = COALESCE(?, category_id),
             price = COALESCE(?, price),
             discount_percent = COALESCE(?, discount_percent),
             stock_quantity = COALESCE(?, stock_quantity),
             sku = COALESCE(?, sku),
             is_active = COALESCE(?, is_active),
             is_featured = COALESCE(?, is_featured)
         WHERE id = ? AND seller_id = ?`,
        [
          name,
          description,
          categoryId,
          price !== undefined ? parseFloat(price) : null,
          discountPercent !== undefined ? parseFloat(discountPercent) : null,
          newStock,
          sku,
          isActive !== undefined ? !!isActive : null,
          isFeatured !== undefined ? !!isFeatured : null,
          productId,
          sellerId
        ]
      );

      // Record inventory adjustment if changed
      const stockDiff = newStock - oldStock;
      if (stockDiff !== 0) {
        await conn.query(
          `INSERT INTO inventory_transactions (product_id, change_quantity, reason, notes)
           VALUES (?, ?, 'ADJUSTMENT', 'Manual inventory adjustment by seller')`,
          [productId, stockDiff]
        );
      }

      // Handle image update if file or URL provided
      if (req.file) {
        const uploadedUrl = `/uploads/${req.file.filename}`;
        await conn.query('UPDATE product_images SET image_url = ? WHERE product_id = ? AND is_primary = TRUE', [
          uploadedUrl,
          productId
        ]);
      } else if (imageUrl) {
        await conn.query('UPDATE product_images SET image_url = ? WHERE product_id = ? AND is_primary = TRUE', [
          imageUrl,
          productId
        ]);
      }
    });

    return success(res, 'Product updated successfully');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/seller/products/:id (Delete product)
exports.deleteProduct = async (req, res, next) => {
  try {
    const sellerId = req.user.sellerId || (await getSellerIdFromUser(req.user.userId));
    const productId = req.params.id;

    const [result] = await db.query(
      'DELETE FROM products WHERE id = ? AND seller_id = ?',
      [productId, sellerId]
    );

    if (result.affectedRows === 0) {
      return forbidden(res, 'Product not found or unauthorized to delete');
    }

    return success(res, 'Product deleted successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/seller/orders (Seller's received orders)
exports.getOrders = async (req, res, next) => {
  try {
    const sellerId = req.user.sellerId || (await getSellerIdFromUser(req.user.userId));
    if (!sellerId) return forbidden(res, 'Seller profile not found');

    const [orders] = await db.query(
      `SELECT oi.id AS order_item_id, oi.order_id, oi.product_id, oi.product_name, oi.unit_price, 
              oi.quantity, oi.total_price, oi.status AS item_status, oi.created_at,
              o.order_number, o.order_status, o.shipping_address_text,
              cust.full_name AS customer_name, cust.mobile_number AS customer_phone,
              p.payment_method, p.payment_status
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN customers cust ON cust.id = o.customer_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE oi.seller_id = ?
       ORDER BY oi.created_at DESC`,
      [sellerId]
    );

    return success(res, 'Seller orders fetched', orders);
  } catch (err) {
    next(err);
  }
};

// PUT /api/seller/orders/:id/status (Accept, reject, or update status)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const sellerId = req.user.sellerId || (await getSellerIdFromUser(req.user.userId));
    const orderId = req.params.id;
    const { status, reason } = req.body;

    const validStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return badRequest(res, `Invalid status. Valid values: ${validStatuses.join(', ')}`);
    }

    // Verify this order contains seller's items
    const [items] = await db.query(
      'SELECT id, product_id, quantity, status FROM order_items WHERE order_id = ? AND seller_id = ?',
      [orderId, sellerId]
    );

    if (items.length === 0) {
      return forbidden(res, 'You do not have items in this order or order does not exist');
    }

    await db.withTransaction(async (conn) => {
      // 1. Update seller's order items
      await conn.query(
        'UPDATE order_items SET status = ? WHERE order_id = ? AND seller_id = ?',
        [status, orderId, sellerId]
      );

      // 2. Update overall order status
      await conn.query('UPDATE orders SET order_status = ? WHERE id = ?', [status, orderId]);

      // 3. If rejected/cancelled by seller, restore inventory
      if (status === 'CANCELLED') {
        for (const item of items) {
          await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [
            item.quantity,
            item.product_id
          ]);
          await conn.query(
            `INSERT INTO inventory_transactions (product_id, change_quantity, reason, reference_order_id, notes)
             VALUES (?, ?, 'ORDER_CANCELLED', ?, ?)`,
            [item.product_id, item.quantity, orderId, `Seller cancelled: ${reason || 'Item unavailable'}`]
          );
        }
      }

      // 4. Log in status history
      await conn.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_user_id, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, items[0].status, status, req.user.userId, `Status updated to ${status} by seller. ${reason || ''}`]
      );

      // 5. Notify customer
      await conn.query(
        `INSERT INTO notifications (user_id, title, message)
         SELECT c.user_id, ?, ?
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         WHERE o.id = ?`,
        [`Order Update: ${status}`, `Your order status has been updated to ${status}.`, orderId]
      );
    });

    return success(res, `Order status successfully updated to ${status}`);
  } catch (err) {
    next(err);
  }
};

// GET /api/seller/sales (Sales analytics)
exports.getSales = async (req, res, next) => {
  try {
    const sellerId = req.user.sellerId || (await getSellerIdFromUser(req.user.userId));
    if (!sellerId) return forbidden(res, 'Seller profile not found');

    // Daily sales last 7 days
    const [dailySales] = await db.query(
      `SELECT DATE(oi.created_at) AS date,
              COUNT(DISTINCT oi.order_id) AS orders_count,
              SUM(oi.total_price) AS daily_revenue
       FROM order_items oi
       WHERE oi.seller_id = ? AND oi.status != 'CANCELLED'
         AND oi.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(oi.created_at)
       ORDER BY date ASC`,
      [sellerId]
    );

    // Monthly sales last 6 months
    const [monthlySales] = await db.query(
      `SELECT DATE_FORMAT(oi.created_at, '%Y-%m') AS month,
              COUNT(DISTINCT oi.order_id) AS orders_count,
              SUM(oi.total_price) AS monthly_revenue
       FROM order_items oi
       WHERE oi.seller_id = ? AND oi.status != 'CANCELLED'
         AND oi.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(oi.created_at, '%Y-%m')
       ORDER BY month ASC`,
      [sellerId]
    );

    return success(res, 'Seller sales analytics', {
      dailySales,
      monthlySales
    });
  } catch (err) {
    next(err);
  }
};

// Profile & business details
exports.getProfile = async (req, res, next) => {
  try {
    const sellerId = req.user.sellerId || (await getSellerIdFromUser(req.user.userId));
    const [rows] = await db.query(
      `SELECT s.*, u.email 
       FROM sellers s 
       JOIN users u ON u.id = s.user_id 
       WHERE s.id = ?`,
      [sellerId]
    );
    if (rows.length === 0) return notFound(res, 'Seller profile not found');
    return success(res, 'Seller profile', rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const sellerId = req.user.sellerId || (await getSellerIdFromUser(req.user.userId));
    const { businessName, ownerName, mobileNumber, businessAddress, gstNumber } = req.body;

    await db.query(
      `UPDATE sellers 
       SET business_name = COALESCE(?, business_name),
           owner_name = COALESCE(?, owner_name),
           mobile_number = COALESCE(?, mobile_number),
           business_address = COALESCE(?, business_address),
           gst_number = COALESCE(?, gst_number)
       WHERE id = ?`,
      [businessName, ownerName, mobileNumber, businessAddress, gstNumber, sellerId]
    );

    return success(res, 'Seller profile updated successfully');
  } catch (err) {
    next(err);
  }
};
