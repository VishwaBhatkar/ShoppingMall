const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { success, badRequest, notFound } = require('../utils/responseUtils');

// GET /api/admin/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const [custStats] = await db.query('SELECT COUNT(*) AS total_customers FROM customers');
    const [sellerStats] = await db.query(
      `SELECT COUNT(*) AS total_sellers,
              COUNT(CASE WHEN approval_status = 'PENDING' THEN 1 END) AS pending_sellers
       FROM sellers`
    );
    const [prodStats] = await db.query('SELECT COUNT(*) AS total_products FROM products');
    const [orderStats] = await db.query(
      `SELECT COUNT(*) AS total_orders,
              COALESCE(SUM(CASE WHEN order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS total_revenue
       FROM orders`
    );

    // Recent orders
    const [recentOrders] = await db.query(
      `SELECT o.id, o.order_number, o.total_amount, o.order_status, o.created_at,
              c.full_name AS customer_name, u.email AS customer_email
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN users u ON u.id = c.user_id
       ORDER BY o.created_at DESC LIMIT 6`
    );

    // Recent pending sellers
    const [pendingSellersList] = await db.query(
      `SELECT s.id, s.business_name, s.owner_name, s.mobile_number, s.approval_status, s.created_at, u.email
       FROM sellers s
       JOIN users u ON u.id = s.user_id
       WHERE s.approval_status = 'PENDING'
       ORDER BY s.created_at DESC`
    );

    return success(res, 'Admin dashboard statistics', {
      totalCustomers: custStats[0].total_customers,
      totalSellers: sellerStats[0].total_sellers,
      pendingSellerApprovals: sellerStats[0].pending_sellers,
      totalProducts: prodStats[0].total_products,
      totalOrders: orderStats[0].total_orders,
      totalRevenue: parseFloat(orderStats[0].total_revenue || 0),
      recentOrders,
      pendingSellersList
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// CUSTOMER MANAGEMENT
// -------------------------------------------------------------

exports.getCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT c.*, u.email, u.is_active,
             (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) AS total_orders,
             (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = c.id AND order_status != 'CANCELLED') AS total_spent
      FROM customers c
      JOIN users u ON u.id = c.user_id
    `;
    const params = [];

    if (search) {
      query += ' WHERE c.full_name LIKE ? OR u.email LIKE ? OR c.mobile_number LIKE ?';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY c.created_at DESC';

    const [customers] = await db.query(query, params);
    return success(res, 'Customers list', customers);
  } catch (err) {
    next(err);
  }
};

exports.updateCustomerStatus = async (req, res, next) => {
  try {
    const customerId = req.params.id;
    const { isActive } = req.body;

    const [rows] = await db.query('SELECT user_id FROM customers WHERE id = ?', [customerId]);
    if (rows.length === 0) return notFound(res, 'Customer not found');

    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [!!isActive, rows[0].user_id]);
    return success(res, `Customer status updated to ${isActive ? 'Active' : 'Inactive'}`);
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const customerId = req.params.id;
    const [rows] = await db.query('SELECT user_id FROM customers WHERE id = ?', [customerId]);
    if (rows.length === 0) return notFound(res, 'Customer not found');

    await db.query('DELETE FROM users WHERE id = ?', [rows[0].user_id]);
    return success(res, 'Customer account deleted');
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// SELLER MANAGEMENT
// -------------------------------------------------------------

exports.getSellers = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT s.*, u.email, u.is_active,
             (SELECT COUNT(*) FROM products WHERE seller_id = s.id) AS total_products,
             (SELECT COUNT(DISTINCT order_id) FROM order_items WHERE seller_id = s.id) AS total_orders,
             (SELECT COALESCE(SUM(total_price), 0) FROM order_items WHERE seller_id = s.id AND status != 'CANCELLED') AS total_revenue
      FROM sellers s
      JOIN users u ON u.id = s.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND s.approval_status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (s.business_name LIKE ? OR s.owner_name LIKE ? OR u.email LIKE ? OR s.mobile_number LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY s.created_at DESC';

    const [sellers] = await db.query(query, params);
    return success(res, 'Sellers fetched', sellers);
  } catch (err) {
    next(err);
  }
};

exports.approveSeller = async (req, res, next) => {
  try {
    const sellerId = req.params.id;

    const [rows] = await db.query('SELECT s.id, s.user_id, s.business_name FROM sellers s WHERE s.id = ?', [sellerId]);
    if (rows.length === 0) return notFound(res, 'Seller not found');

    await db.query("UPDATE sellers SET approval_status = 'APPROVED', rejection_reason = NULL WHERE id = ?", [sellerId]);

    // Send notification to seller
    await db.query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES (?, 'Seller Account Approved!', 'Congratulations! Your seller account has been approved. You can now login and start listing products.')`,
      [rows[0].user_id]
    );

    return success(res, `Seller "${rows[0].business_name}" approved successfully`);
  } catch (err) {
    next(err);
  }
};

exports.rejectSeller = async (req, res, next) => {
  try {
    const sellerId = req.params.id;
    const { reason = 'Application does not meet onboarding guidelines' } = req.body;

    const [rows] = await db.query('SELECT s.id, s.user_id, s.business_name FROM sellers s WHERE s.id = ?', [sellerId]);
    if (rows.length === 0) return notFound(res, 'Seller not found');

    await db.query("UPDATE sellers SET approval_status = 'REJECTED', rejection_reason = ? WHERE id = ?", [reason, sellerId]);

    await db.query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES (?, 'Seller Application Rejected', ?)`,
      [rows[0].user_id, `Your seller registration was rejected. Reason: ${reason}`]
    );

    return success(res, `Seller "${rows[0].business_name}" rejected`);
  } catch (err) {
    next(err);
  }
};

exports.updateSellerStatus = async (req, res, next) => {
  try {
    const sellerId = req.params.id;
    const { status, reason } = req.body;

    const validStatuses = ['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return badRequest(res, `Invalid status. Valid values: ${validStatuses.join(', ')}`);
    }

    await db.query(
      'UPDATE sellers SET approval_status = ?, rejection_reason = ? WHERE id = ?',
      [status, reason || null, sellerId]
    );

    return success(res, `Seller status updated to ${status}`);
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// PRODUCT MANAGEMENT (ADMIN)
// -------------------------------------------------------------

exports.getProducts = async (req, res, next) => {
  try {
    const { search, categoryId } = req.query;
    let query = `
      SELECT p.*, c.name AS category_name, s.business_name AS seller_name,
             (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) AS primary_image
      FROM products p
      JOIN categories c ON c.id = p.category_id
      JOIN sellers s ON s.id = p.seller_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR s.business_name LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (categoryId) {
      query += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    query += ' ORDER BY p.created_at DESC';

    const [products] = await db.query(query, params);
    return success(res, 'All products fetched', products);
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const { isActive, isApproved, isFeatured, price, discountPercent } = req.body;

    await db.query(
      `UPDATE products 
       SET is_active = COALESCE(?, is_active),
           is_approved = COALESCE(?, is_approved),
           is_featured = COALESCE(?, is_featured),
           price = COALESCE(?, price),
           discount_percent = COALESCE(?, discount_percent)
       WHERE id = ?`,
      [
        isActive !== undefined ? !!isActive : null,
        isApproved !== undefined ? !!isApproved : null,
        isFeatured !== undefined ? !!isFeatured : null,
        price !== undefined ? parseFloat(price) : null,
        discountPercent !== undefined ? parseFloat(discountPercent) : null,
        productId
      ]
    );

    return success(res, 'Product updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [productId]);
    if (result.affectedRows === 0) return notFound(res, 'Product not found');
    return success(res, 'Product removed by admin');
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// ORDER MANAGEMENT (ADMIN)
// -------------------------------------------------------------

exports.getOrders = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT o.*, c.full_name AS customer_name, c.mobile_number AS customer_phone,
             p.payment_method, p.payment_status, p.transaction_reference,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND o.order_status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (o.order_number LIKE ? OR c.full_name LIKE ? OR c.mobile_number LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY o.created_at DESC';

    const [orders] = await db.query(query, params);
    return success(res, 'All orders fetched', orders);
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// CATEGORY MANAGEMENT
// -------------------------------------------------------------

exports.getCategories = async (req, res, next) => {
  try {
    const [categories] = await db.query(
      `SELECT c.*, COUNT(p.id) AS product_count 
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name ASC`
    );
    return success(res, 'Categories fetched', categories);
  } catch (err) {
    next(err);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, imageUrl, isActive = true } = req.body;
    if (!name || !name.trim()) return badRequest(res, 'Category name is required');

    const [existing] = await db.query('SELECT id FROM categories WHERE name = ?', [name.trim()]);
    if (existing.length > 0) return badRequest(res, 'A category with this name already exists');

    const [result] = await db.query(
      'INSERT INTO categories (name, description, image_url, is_active) VALUES (?, ?, ?, ?)',
      [name.trim(), description || '', imageUrl || null, !!isActive]
    );

    return success(res, 'Category created', { id: result.insertId, name, description, imageUrl, isActive }, 201);
  } catch (err) {
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const categoryId = req.params.id;
    const { name, description, imageUrl, isActive } = req.body;

    await db.query(
      `UPDATE categories 
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           image_url = COALESCE(?, image_url),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, description, imageUrl, isActive !== undefined ? !!isActive : null, categoryId]
    );

    return success(res, 'Category updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const categoryId = req.params.id;
    // Check if products exist in category
    const [prods] = await db.query('SELECT COUNT(*) AS cnt FROM products WHERE category_id = ?', [categoryId]);
    if (prods[0].cnt > 0) {
      return badRequest(res, `Cannot delete category: contains ${prods[0].cnt} products. Deactivate it instead.`);
    }

    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [categoryId]);
    if (result.affectedRows === 0) return notFound(res, 'Category not found');

    return success(res, 'Category deleted successfully');
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// REPORTS & ANALYTICS
// -------------------------------------------------------------

exports.getReports = async (req, res, next) => {
  try {
    // 1. Total revenue & orders overview
    const [overview] = await db.query(
      `SELECT COUNT(*) AS total_orders,
              COALESCE(SUM(CASE WHEN order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS total_revenue,
              COALESCE(AVG(CASE WHEN order_status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS average_order_value
       FROM orders`
    );

    // 2. Customer growth by month
    const [customerGrowth] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM customers
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC LIMIT 6`
    );

    // 3. Seller growth by month
    const [sellerGrowth] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM sellers
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC LIMIT 6`
    );

    // 4. Top selling products
    const [topProducts] = await db.query(
      `SELECT oi.product_id, oi.product_name, 
              SUM(oi.quantity) AS units_sold, 
              SUM(oi.total_price) AS total_sales,
              (SELECT image_url FROM product_images WHERE product_id = oi.product_id ORDER BY is_primary DESC, id ASC LIMIT 1) AS primary_image
       FROM order_items oi
       WHERE oi.status != 'CANCELLED'
       GROUP BY oi.product_id, oi.product_name
       ORDER BY units_sold DESC LIMIT 5`
    );

    // 5. Monthly sales report
    const [monthlySales] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
              COUNT(*) AS orders_count,
              SUM(total_amount) AS revenue
       FROM orders
       WHERE order_status != 'CANCELLED'
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC LIMIT 6`
    );

    return success(res, 'Admin analytics reports', {
      totalOrders: overview[0].total_orders,
      totalRevenue: parseFloat(overview[0].total_revenue || 0),
      averageOrderValue: parseFloat(overview[0].average_order_value || 0),
      customerGrowth,
      sellerGrowth,
      topProducts,
      monthlySales
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// ADMIN PROFILE & PASSWORD
// -------------------------------------------------------------

exports.getProfile = async (req, res, next) => {
  return success(res, 'Admin profile fetched', {
    userId: req.user.userId,
    email: req.user.email,
    name: 'Master Administrator',
    role: 'ADMIN'
  });
};

exports.changePassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return badRequest(res, 'New password must be at least 6 characters');
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE role = ?', [hash, 'ADMIN']);

    return success(res, 'Administrator password changed successfully');
  } catch (err) {
    next(err);
  }
};
