const db = require('../config/database');
const { success, badRequest, notFound } = require('../utils/responseUtils');

// Helper to get or create cart for customer
async function getOrCreateCartId(customerId) {
  const [carts] = await db.query('SELECT id FROM carts WHERE customer_id = ?', [customerId]);
  if (carts.length > 0) return carts[0].id;
  const [res] = await db.query('INSERT INTO carts (customer_id) VALUES (?)', [customerId]);
  return res.insertId;
}

// GET /api/cart
exports.getCart = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const cartId = await getOrCreateCartId(customerId);

    const [items] = await db.query(
      `SELECT ci.id AS cart_item_id, ci.quantity, ci.created_at,
              p.id AS product_id, p.name, p.price, p.discount_percent, p.stock_quantity, p.is_active,
              s.business_name AS seller_name,
              (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) AS primary_image
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN sellers s ON s.id = p.seller_id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    let subtotal = 0;
    const enrichedItems = items.map((item) => {
      const discount = parseFloat(item.discount_percent || 0);
      const originalPrice = parseFloat(item.price);
      const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
      const itemTotal = finalPrice * item.quantity;
      subtotal += itemTotal;

      return {
        ...item,
        unit_price: originalPrice,
        final_unit_price: parseFloat(finalPrice.toFixed(2)),
        total_price: parseFloat(itemTotal.toFixed(2)),
        is_in_stock: item.stock_quantity >= item.quantity
      };
    });

    const tax = parseFloat((subtotal * 0.08).toFixed(2)); // 8% standard tax
    const shippingFee = subtotal > 50 || subtotal === 0 ? 0.0 : 5.0; // Free shipping over $50
    const totalAmount = parseFloat((subtotal + tax + shippingFee).toFixed(2));

    return success(res, 'Cart fetched successfully', {
      cartId,
      items: enrichedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax,
      shippingFee,
      totalAmount,
      itemCount: enrichedItems.reduce((acc, curr) => acc + curr.quantity, 0)
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/cart (Add product to cart)
exports.addToCart = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const { productId, quantity = 1 } = req.body;

    const addQty = parseInt(quantity, 10);
    if (!productId || isNaN(addQty) || addQty <= 0) {
      return badRequest(res, 'Valid productId and positive quantity are required');
    }

    // Check product stock and active state
    const [products] = await db.query(
      'SELECT id, name, price, stock_quantity, is_active FROM products WHERE id = ?',
      [productId]
    );
    if (products.length === 0 || !products[0].is_active) {
      return notFound(res, 'Product is unavailable');
    }

    const product = products[0];
    const cartId = await getOrCreateCartId(customerId);

    // Check if item already exists in cart
    const [existing] = await db.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, productId]
    );

    let newQuantity = addQty;
    if (existing.length > 0) {
      newQuantity = existing[0].quantity + addQty;
    }

    if (newQuantity > product.stock_quantity) {
      return badRequest(
        res,
        `Cannot add ${addQty} more item(s). Available stock is ${product.stock_quantity} (you currently have ${existing.length > 0 ? existing[0].quantity : 0} in cart)`
      );
    }

    if (existing.length > 0) {
      await db.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [newQuantity, existing[0].id]);
    } else {
      await db.query('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)', [
        cartId,
        productId,
        newQuantity
      ]);
    }

    return success(res, 'Product added to cart successfully');
  } catch (err) {
    next(err);
  }
};

// PUT /api/cart/items/:itemId (Update item quantity)
exports.updateCartItem = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const cartItemId = req.params.itemId;
    const { quantity } = req.body;

    const targetQty = parseInt(quantity, 10);
    if (isNaN(targetQty)) return badRequest(res, 'Valid quantity is required');

    const cartId = await getOrCreateCartId(customerId);

    // Verify ownership
    const [items] = await db.query(
      `SELECT ci.id, ci.product_id, ci.quantity, p.stock_quantity 
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.id = ? AND ci.cart_id = ?`,
      [cartItemId, cartId]
    );

    if (items.length === 0) {
      return notFound(res, 'Cart item not found');
    }

    if (targetQty <= 0) {
      await db.query('DELETE FROM cart_items WHERE id = ?', [cartItemId]);
      return success(res, 'Item removed from cart');
    }

    if (targetQty > items[0].stock_quantity) {
      return badRequest(res, `Cannot update quantity. Only ${items[0].stock_quantity} available in stock.`);
    }

    await db.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [targetQty, cartItemId]);
    return success(res, 'Cart updated successfully');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cart/items/:itemId (Remove single item)
exports.removeCartItem = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const cartItemId = req.params.itemId;
    const cartId = await getOrCreateCartId(customerId);

    const [result] = await db.query('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', [
      cartItemId,
      cartId
    ]);

    if (result.affectedRows === 0) {
      return notFound(res, 'Item not found in cart');
    }

    return success(res, 'Item removed from cart');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cart (Clear entire cart)
exports.clearCart = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const cartId = await getOrCreateCartId(customerId);
    await db.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
    return success(res, 'Cart cleared');
  } catch (err) {
    next(err);
  }
};
