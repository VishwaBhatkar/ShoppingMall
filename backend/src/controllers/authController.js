const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { signToken } = require('../utils/jwtUtils');
const { success, created, badRequest, unauthorized, forbidden } = require('../utils/responseUtils');

// Hardcoded Admin Credentials Configuration
const HARDCODED_ADMIN = {
  email: (process.env.ADMIN_EMAIL || 'admin@shoppingmall.com').toLowerCase(),
  password: process.env.ADMIN_PASSWORD || 'Admin@123',
  userId: 1,
  name: 'Master Administrator'
};

// -------------------------------------------------------------
// CUSTOMER AUTHENTICATION
// -------------------------------------------------------------

exports.customerRegister = async (req, res, next) => {
  try {
    const { fullName, email, mobileNumber, password, address } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // Check existing email
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      return badRequest(res, 'An account with this email already exists');
    }

    // Check existing mobile
    const [existingMobile] = await db.query('SELECT id FROM customers WHERE mobile_number = ?', [mobileNumber]);
    if (existingMobile.length > 0) {
      return badRequest(res, 'An account with this mobile number already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.withTransaction(async (conn) => {
      // 1. Insert user
      const [userRes] = await conn.query(
        'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
        [cleanEmail, passwordHash, 'CUSTOMER']
      );
      const userId = userRes.insertId;

      // 2. Insert customer profile
      const [custRes] = await conn.query(
        'INSERT INTO customers (user_id, full_name, mobile_number, address) VALUES (?, ?, ?, ?)',
        [userId, fullName.trim(), mobileNumber.trim(), address || '']
      );
      const customerId = custRes.insertId;

      // 3. Create default cart & wishlist
      await conn.query('INSERT INTO carts (customer_id) VALUES (?)', [customerId]);
      await conn.query('INSERT INTO wishlists (customer_id) VALUES (?)', [customerId]);

      // 4. Welcome notification
      await conn.query(
        'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
        [userId, 'Welcome to Shopping Mall!', 'Your customer account has been created successfully. Enjoy shopping!']
      );

      return { userId, customerId, email: cleanEmail, fullName, mobileNumber };
    });

    const token = signToken({
      userId: result.userId,
      email: result.email,
      role: 'CUSTOMER',
      customerId: result.customerId
    });

    return created(res, 'Registration successful. Welcome to Shopping Mall!', {
      token,
      user: {
        id: result.userId,
        customerId: result.customerId,
        email: result.email,
        fullName: result.fullName,
        mobileNumber: result.mobileNumber,
        role: 'CUSTOMER'
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.customerLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    const [users] = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.is_active, 
              c.id AS customer_id, c.full_name, c.mobile_number, c.address, c.avatar_url
       FROM users u
       LEFT JOIN customers c ON c.user_id = u.id
       WHERE u.email = ? AND u.role = 'CUSTOMER'`,
      [cleanEmail]
    );

    if (users.length === 0) {
      return unauthorized(res, 'Invalid email or password');
    }

    const user = users[0];

    if (!user.is_active) {
      return forbidden(res, 'This customer account has been deactivated. Please contact support.');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return unauthorized(res, 'Invalid email or password');
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: 'CUSTOMER',
      customerId: user.customer_id
    });

    return success(res, 'Login successful', {
      token,
      user: {
        id: user.id,
        customerId: user.customer_id,
        email: user.email,
        fullName: user.full_name,
        mobileNumber: user.mobile_number,
        address: user.address,
        avatarUrl: user.avatar_url,
        role: 'CUSTOMER'
      }
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// SELLER AUTHENTICATION
// -------------------------------------------------------------

exports.sellerRegister = async (req, res, next) => {
  try {
    const { businessName, ownerName, email, mobileNumber, password, businessAddress, gstNumber } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // Check existing email
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      return badRequest(res, 'An account with this email already exists');
    }

    // Check existing seller mobile
    const [existingMobile] = await db.query('SELECT id FROM sellers WHERE mobile_number = ?', [mobileNumber]);
    if (existingMobile.length > 0) {
      return badRequest(res, 'An account with this mobile number already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.withTransaction(async (conn) => {
      // 1. Insert user
      const [userRes] = await conn.query(
        'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
        [cleanEmail, passwordHash, 'SELLER']
      );
      const userId = userRes.insertId;

      // 2. Insert seller profile with PENDING status
      const [sellerRes] = await conn.query(
        `INSERT INTO sellers 
         (user_id, business_name, owner_name, mobile_number, business_address, gst_number, approval_status) 
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
        [userId, businessName.trim(), ownerName.trim(), mobileNumber.trim(), businessAddress.trim(), gstNumber || null]
      );
      const sellerId = sellerRes.insertId;

      // 3. Notification to Admin
      await conn.query(
        `INSERT INTO notifications (user_id, title, message) 
         SELECT id, 'New Seller Registration', ? FROM users WHERE role = 'ADMIN' LIMIT 1`,
        [`Seller "${businessName}" has registered and requires approval.`]
      );

      return { userId, sellerId, email: cleanEmail, businessName, ownerName };
    });

    return created(res, 'Seller registered successfully. Your account is currently PENDING approval from the administrator.', {
      seller: {
        id: result.sellerId,
        userId: result.userId,
        email: result.email,
        businessName: result.businessName,
        approvalStatus: 'PENDING'
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.sellerLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    const [sellers] = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.is_active,
              s.id AS seller_id, s.business_name, s.owner_name, s.mobile_number, 
              s.business_address, s.gst_number, s.approval_status, s.rejection_reason
       FROM users u
       LEFT JOIN sellers s ON s.user_id = u.id
       WHERE u.email = ? AND u.role = 'SELLER'`,
      [cleanEmail]
    );

    if (sellers.length === 0) {
      return unauthorized(res, 'Invalid seller email or password');
    }

    const seller = sellers[0];

    if (!seller.is_active) {
      return forbidden(res, 'This seller account has been deactivated. Please contact support.');
    }

    const isMatch = await bcrypt.compare(password, seller.password_hash);
    if (!isMatch) {
      return unauthorized(res, 'Invalid seller email or password');
    }

    // Check approval status
    if (seller.approval_status === 'PENDING') {
      return forbidden(
        res,
        'Your seller account is currently PENDING admin approval. You will gain access to the dashboard once verified and approved.'
      );
    }

    if (seller.approval_status === 'REJECTED') {
      return forbidden(
        res,
        `Your seller application has been REJECTED. Reason: ${seller.rejection_reason || 'Compliance criteria not met'}`
      );
    }

    if (seller.approval_status === 'SUSPENDED') {
      return forbidden(res, 'Your seller account is SUSPENDED. Please contact administrator.');
    }

    const token = signToken({
      userId: seller.id,
      email: seller.email,
      role: 'SELLER',
      sellerId: seller.seller_id
    });

    return success(res, 'Seller login successful', {
      token,
      user: {
        id: seller.id,
        sellerId: seller.seller_id,
        email: seller.email,
        businessName: seller.business_name,
        ownerName: seller.owner_name,
        mobileNumber: seller.mobile_number,
        businessAddress: seller.business_address,
        gstNumber: seller.gst_number,
        approvalStatus: seller.approval_status,
        role: 'SELLER'
      }
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// ADMIN AUTHENTICATION (Hardcoded Server-Side Protection)
// -------------------------------------------------------------

exports.adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    // Verify against hardcoded credentials in backend configuration
    const isHardcodedEmail = cleanEmail === HARDCODED_ADMIN.email;
    const isHardcodedPass = password === HARDCODED_ADMIN.password;

    if (!isHardcodedEmail) {
      return unauthorized(res, 'Invalid administrator credentials');
    }

    if (!isHardcodedPass) {
      // Also check if admin password was updated in DB
      let dbAdminVerified = false;
      try {
        const [admins] = await db.query(
          `SELECT u.id, u.email, u.password_hash, u.is_active, a.name 
           FROM users u 
           JOIN admins a ON a.user_id = u.id 
           WHERE u.email = ? AND u.role = 'ADMIN'`,
          [cleanEmail]
        );
        if (admins.length > 0 && admins[0].is_active) {
          dbAdminVerified = await bcrypt.compare(password, admins[0].password_hash);
        }
      } catch (dbErr) {
        console.warn('[AdminLogin] DB query failed, relying on server config:', dbErr.message);
      }

      if (!dbAdminVerified) {
        return unauthorized(res, 'Invalid administrator credentials');
      }
    }

    // Find or synchronize admin record in database
    let adminUserId = HARDCODED_ADMIN.userId;
    let adminName = HARDCODED_ADMIN.name;

    try {
      const [rows] = await db.query('SELECT id FROM users WHERE email = ? AND role = ?', [cleanEmail, 'ADMIN']);
      if (rows.length > 0) {
        adminUserId = rows[0].id;
      } else {
        const hash = await bcrypt.hash(HARDCODED_ADMIN.password, 10);
        const [newAdmin] = await db.query(
          'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
          [cleanEmail, hash, 'ADMIN']
        );
        adminUserId = newAdmin.insertId;
        await db.query('INSERT INTO admins (user_id, name) VALUES (?, ?)', [adminUserId, HARDCODED_ADMIN.name]);
      }
    } catch (e) {
      console.warn('[AdminLogin] DB sync warning:', e.message);
    }

    const token = signToken({
      userId: adminUserId,
      email: cleanEmail,
      role: 'ADMIN'
    });

    return success(res, 'Administrator authentication successful', {
      token,
      user: {
        userId: adminUserId,
        email: cleanEmail,
        name: adminName,
        role: 'ADMIN'
      }
    });
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// CURRENT USER PROFILE (/api/auth/me)
// -------------------------------------------------------------

exports.getMe = async (req, res, next) => {
  try {
    const { userId, role } = req.user;

    if (role === 'ADMIN') {
      return success(res, 'Admin profile fetched', {
        id: userId,
        email: req.user.email,
        name: HARDCODED_ADMIN.name,
        role: 'ADMIN'
      });
    }

    if (role === 'CUSTOMER') {
      const [rows] = await db.query(
        `SELECT u.id, u.email, u.role, u.is_active,
                c.id AS customer_id, c.full_name, c.mobile_number, c.address, c.avatar_url
         FROM users u
         JOIN customers c ON c.user_id = u.id
         WHERE u.id = ?`,
        [userId]
      );
      if (rows.length === 0) return unauthorized(res, 'Customer profile not found');
      return success(res, 'Customer profile fetched', rows[0]);
    }

    if (role === 'SELLER') {
      const [rows] = await db.query(
        `SELECT u.id, u.email, u.role, u.is_active,
                s.id AS seller_id, s.business_name, s.owner_name, s.mobile_number, 
                s.business_address, s.gst_number, s.approval_status
         FROM users u
         JOIN sellers s ON s.user_id = u.id
         WHERE u.id = ?`,
        [userId]
      );
      if (rows.length === 0) return unauthorized(res, 'Seller profile not found');
      return success(res, 'Seller profile fetched', rows[0]);
    }

    return badRequest(res, 'Unknown user role');
  } catch (err) {
    next(err);
  }
};

// -------------------------------------------------------------
// LOGOUT
// -------------------------------------------------------------

exports.logout = async (req, res) => {
  return success(res, 'Logged out successfully');
};

// -------------------------------------------------------------
// FORGOT & RESET PASSWORD
// -------------------------------------------------------------

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return badRequest(res, 'Email is required');

    const [rows] = await db.query('SELECT id, role FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (rows.length === 0) {
      // Do not disclose user existence for security
      return success(res, 'If your email is registered, you will receive password reset instructions.');
    }

    // In a production system an email with reset token is sent.
    // For demo/simulated flow we return a simulation code.
    return success(res, 'Password reset instructions sent. Demo reset code: 123456');
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, resetCode, newPassword } = req.body;
    if (!email || !newPassword) return badRequest(res, 'Email and new password are required');
    if (newPassword.length < 6) return badRequest(res, 'Password must be at least 6 characters');

    const newHash = await bcrypt.hash(newPassword, 10);
    const [result] = await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [
      newHash,
      email.toLowerCase().trim()
    ]);

    if (result.affectedRows === 0) {
      return badRequest(res, 'User with this email not found');
    }

    return success(res, 'Password reset successfully. You can now login with your new password.');
  } catch (err) {
    next(err);
  }
};
