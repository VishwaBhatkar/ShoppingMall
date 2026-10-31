const db = require('../config/database');
const { success, notFound, badRequest } = require('../utils/responseUtils');

// Helper to attach primary image or image list
async function attachImagesToProducts(products) {
  if (!products || products.length === 0) return [];

  const productIds = products.map((p) => p.id);
  const [images] = await db.query(
    'SELECT id, product_id, image_url, is_primary FROM product_images WHERE product_id IN (?) ORDER BY is_primary DESC, id ASC',
    [productIds]
  );

  const imageMap = {};
  images.forEach((img) => {
    if (!imageMap[img.product_id]) imageMap[img.product_id] = [];
    imageMap[img.product_id].push(img);
  });

  return products.map((p) => ({
    ...p,
    images: imageMap[p.id] || [],
    primary_image: imageMap[p.id] && imageMap[p.id].length > 0 ? imageMap[p.id][0].image_url : null
  }));
}

// GET /api/products (Browse all, filter, sort, search)
exports.getAllProducts = async (req, res, next) => {
  try {
    const {
      search,
      categoryId,
      minPrice,
      maxPrice,
      sortBy, // 'price_asc', 'price_desc', 'newest', 'popular'
      featured,
      inStock
    } = req.query;

    let query = `
      SELECT p.*, c.name AS category_name, s.business_name AS seller_name,
             (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) AS average_rating,
             (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) AS review_count
      FROM products p
      JOIN categories c ON c.id = p.category_id
      JOIN sellers s ON s.id = p.seller_id
      WHERE p.is_active = TRUE AND p.is_approved = TRUE AND s.approval_status = 'APPROVED'
    `;
    const params = [];

    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (categoryId) {
      query += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    if (minPrice !== undefined && minPrice !== '') {
      query += ' AND p.price >= ?';
      params.push(parseFloat(minPrice));
    }

    if (maxPrice !== undefined && maxPrice !== '') {
      query += ' AND p.price <= ?';
      params.push(parseFloat(maxPrice));
    }

    if (featured === 'true' || featured === '1') {
      query += ' AND p.is_featured = TRUE';
    }

    if (inStock === 'true' || inStock === '1') {
      query += ' AND p.stock_quantity > 0';
    }

    // Sorting
    if (sortBy === 'price_asc') {
      query += ' ORDER BY p.price ASC';
    } else if (sortBy === 'price_desc') {
      query += ' ORDER BY p.price DESC';
    } else if (sortBy === 'newest') {
      query += ' ORDER BY p.created_at DESC';
    } else {
      query += ' ORDER BY p.is_featured DESC, p.created_at DESC';
    }

    const [products] = await db.query(query, params);
    const enriched = await attachImagesToProducts(products);

    return success(res, 'Products fetched successfully', enriched);
  } catch (err) {
    next(err);
  }
};

// GET /api/products/search
exports.searchProducts = async (req, res, next) => {
  req.query.search = req.query.q || req.query.query || req.query.search || '';
  return exports.getAllProducts(req, res, next);
};

// GET /api/products/featured
exports.getFeaturedProducts = async (req, res, next) => {
  req.query.featured = 'true';
  return exports.getAllProducts(req, res, next);
};

// GET /api/products/category/:categoryId
exports.getProductsByCategory = async (req, res, next) => {
  req.query.categoryId = req.params.categoryId;
  return exports.getAllProducts(req, res, next);
};

// GET /api/products/:id
exports.getProductById = async (req, res, next) => {
  try {
    const productId = req.params.id;

    const [rows] = await db.query(
      `SELECT p.*, c.name AS category_name, 
              s.id AS seller_id, s.business_name, s.owner_name, s.mobile_number AS seller_mobile, s.business_address,
              (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) AS average_rating,
              (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) AS review_count
       FROM products p
       JOIN categories c ON c.id = p.category_id
       JOIN sellers s ON s.id = p.seller_id
       WHERE p.id = ? AND p.is_active = TRUE`,
      [productId]
    );

    if (rows.length === 0) {
      return notFound(res, 'Product not found');
    }

    const product = rows[0];

    // Fetch images
    const [images] = await db.query(
      'SELECT id, image_url, is_primary FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, id ASC',
      [productId]
    );

    // Fetch reviews
    const [reviews] = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, cust.full_name AS customer_name, cust.avatar_url
       FROM reviews r
       JOIN customers cust ON cust.id = r.customer_id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`,
      [productId]
    );

    product.images = images;
    product.primary_image = images.length > 0 ? images[0].image_url : null;
    product.reviews = reviews;

    return success(res, 'Product details retrieved', product);
  } catch (err) {
    next(err);
  }
};

// GET /api/categories (Public category listing)
exports.getCategories = async (req, res, next) => {
  try {
    const [categories] = await db.query(
      `SELECT c.*, COUNT(p.id) AS product_count 
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
       WHERE c.is_active = TRUE
       GROUP BY c.id
       ORDER BY c.name ASC`
    );
    return success(res, 'Categories fetched successfully', categories);
  } catch (err) {
    next(err);
  }
};
