const db = require('../config/database');
const { success, badRequest, notFound } = require('../utils/responseUtils');

async function getOrCreateWishlistId(customerId) {
  const [rows] = await db.query('SELECT id FROM wishlists WHERE customer_id = ?', [customerId]);
  if (rows.length > 0) return rows[0].id;
  const [res] = await db.query('INSERT INTO wishlists (customer_id) VALUES (?)', [customerId]);
  return res.insertId;
}

// GET /api/wishlist
exports.getWishlist = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const wishlistId = await getOrCreateWishlistId(customerId);

    const [items] = await db.query(
      `SELECT wi.id AS wishlist_item_id, wi.created_at,
              p.id AS product_id, p.name, p.price, p.discount_percent, p.stock_quantity, p.is_active,
              s.business_name AS seller_name,
              (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) AS primary_image
       FROM wishlist_items wi
       JOIN products p ON p.id = wi.product_id
       JOIN sellers s ON s.id = p.seller_id
       WHERE wi.wishlist_id = ?
       ORDER BY wi.created_at DESC`,
      [wishlistId]
    );

    return success(res, 'Wishlist fetched successfully', {
      wishlistId,
      items,
      count: items.length
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/wishlist
exports.addToWishlist = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const { productId } = req.body;

    if (!productId) return badRequest(res, 'Product ID is required');

    const wishlistId = await getOrCreateWishlistId(customerId);

    // Check if already in wishlist
    const [existing] = await db.query(
      'SELECT id FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?',
      [wishlistId, productId]
    );

    if (existing.length > 0) {
      return success(res, 'Product is already in wishlist');
    }

    await db.query('INSERT INTO wishlist_items (wishlist_id, product_id) VALUES (?, ?)', [
      wishlistId,
      productId
    ]);

    return success(res, 'Product added to wishlist', null, 201);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/wishlist/:productId
exports.removeFromWishlist = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const productId = req.params.productId;
    const wishlistId = await getOrCreateWishlistId(customerId);

    const [result] = await db.query(
      'DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?',
      [wishlistId, productId]
    );

    if (result.affectedRows === 0) {
      return notFound(res, 'Product not found in wishlist');
    }

    return success(res, 'Product removed from wishlist');
  } catch (err) {
    next(err);
  }
};
