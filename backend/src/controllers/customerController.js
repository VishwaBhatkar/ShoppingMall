const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { success, badRequest, notFound } = require('../utils/responseUtils');

// Get Customer Profile
exports.getProfile = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const [rows] = await db.query(
      `SELECT c.id, c.user_id, u.email, c.full_name, c.mobile_number, c.address, c.avatar_url, c.created_at
       FROM customers c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
      [customerId]
    );

    if (rows.length === 0) return notFound(res, 'Customer profile not found');
    return success(res, 'Profile retrieved', rows[0]);
  } catch (err) {
    next(err);
  }
};

// Update Customer Profile
exports.updateProfile = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const { fullName, mobileNumber, address, avatarUrl } = req.body;

    if (!fullName || !fullName.trim()) return badRequest(res, 'Full name is required');
    if (!mobileNumber || !mobileNumber.trim()) return badRequest(res, 'Mobile number is required');

    // Check duplicate mobile for other customers
    const [existing] = await db.query(
      'SELECT id FROM customers WHERE mobile_number = ? AND id != ?',
      [mobileNumber.trim(), customerId]
    );
    if (existing.length > 0) {
      return badRequest(res, 'Mobile number already used by another customer');
    }

    await db.query(
      `UPDATE customers 
       SET full_name = ?, mobile_number = ?, address = ?, avatar_url = ? 
       WHERE id = ?`,
      [fullName.trim(), mobileNumber.trim(), address || '', avatarUrl || null, customerId]
    );

    return success(res, 'Profile updated successfully', {
      fullName,
      mobileNumber,
      address,
      avatarUrl
    });
  } catch (err) {
    next(err);
  }
};

// Change Customer Password
exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return badRequest(res, 'Current password and new password are required');
    }
    if (newPassword.length < 6) {
      return badRequest(res, 'New password must be at least 6 characters');
    }

    const [users] = await db.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return notFound(res, 'User not found');

    const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isMatch) return badRequest(res, 'Current password does not match');

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    return success(res, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};

// Get All Customer Addresses
exports.getAddresses = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const [rows] = await db.query(
      'SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC',
      [customerId]
    );
    return success(res, 'Addresses fetched', rows);
  } catch (err) {
    next(err);
  }
};

// Add New Delivery Address
exports.addAddress = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const { recipientName, phoneNumber, streetAddress, city, state, postalCode, country, isDefault } = req.body;

    if (!recipientName || !phoneNumber || !streetAddress || !city || !state || !postalCode) {
      return badRequest(res, 'All address fields are required');
    }

    if (isDefault) {
      await db.query('UPDATE addresses SET is_default = FALSE WHERE customer_id = ?', [customerId]);
    }

    const [result] = await db.query(
      `INSERT INTO addresses 
       (customer_id, recipient_name, phone_number, street_address, city, state, postal_code, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, recipientName, phoneNumber, streetAddress, city, state, postalCode, country || 'India', !!isDefault]
    );

    return success(res, 'Address added successfully', {
      id: result.insertId,
      customerId,
      recipientName,
      phoneNumber,
      streetAddress,
      city,
      state,
      postalCode,
      country: country || 'India',
      isDefault: !!isDefault
    }, 201);
  } catch (err) {
    next(err);
  }
};

// Update Address
exports.updateAddress = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const addressId = req.params.id;
    const { recipientName, phoneNumber, streetAddress, city, state, postalCode, country, isDefault } = req.body;

    const [existing] = await db.query(
      'SELECT id FROM addresses WHERE id = ? AND customer_id = ?',
      [addressId, customerId]
    );
    if (existing.length === 0) return notFound(res, 'Address not found or unauthorized');

    if (isDefault) {
      await db.query('UPDATE addresses SET is_default = FALSE WHERE customer_id = ?', [customerId]);
    }

    await db.query(
      `UPDATE addresses 
       SET recipient_name = ?, phone_number = ?, street_address = ?, city = ?, state = ?, postal_code = ?, country = ?, is_default = ?
       WHERE id = ? AND customer_id = ?`,
      [recipientName, phoneNumber, streetAddress, city, state, postalCode, country || 'India', !!isDefault, addressId, customerId]
    );

    return success(res, 'Address updated successfully');
  } catch (err) {
    next(err);
  }
};

// Delete Address
exports.deleteAddress = async (req, res, next) => {
  try {
    const customerId = req.user.customerId;
    const addressId = req.params.id;

    const [result] = await db.query(
      'DELETE FROM addresses WHERE id = ? AND customer_id = ?',
      [addressId, customerId]
    );

    if (result.affectedRows === 0) {
      return notFound(res, 'Address not found or unauthorized');
    }

    return success(res, 'Address deleted successfully');
  } catch (err) {
    next(err);
  }
};
