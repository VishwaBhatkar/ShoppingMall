const { badRequest } = require('../utils/responseUtils');

function validateCustomerRegister(req, res, next) {
  const { fullName, email, mobileNumber, password, confirmPassword } = req.body;
  const errors = {};

  if (!fullName || !fullName.trim()) errors.fullName = 'Full name is required';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Valid email is required';
  if (!mobileNumber || !mobileNumber.trim()) errors.mobileNumber = 'Mobile number is required';
  if (!password || password.length < 6) errors.password = 'Password must be at least 6 characters';
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

  if (Object.keys(errors).length > 0) {
    return badRequest(res, 'Validation failed', errors);
  }
  next();
}

function validateCustomerLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = {};

  if (!email || !email.trim()) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';

  if (Object.keys(errors).length > 0) {
    return badRequest(res, 'Validation failed', errors);
  }
  next();
}

function validateSellerRegister(req, res, next) {
  const { businessName, ownerName, email, mobileNumber, password, businessAddress } = req.body;
  const errors = {};

  if (!businessName || !businessName.trim()) errors.businessName = 'Business name is required';
  if (!ownerName || !ownerName.trim()) errors.ownerName = 'Owner name is required';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Valid business email is required';
  if (!mobileNumber || !mobileNumber.trim()) errors.mobileNumber = 'Mobile number is required';
  if (!password || password.length < 6) errors.password = 'Password must be at least 6 characters';
  if (!businessAddress || !businessAddress.trim()) errors.businessAddress = 'Business address is required';

  if (Object.keys(errors).length > 0) {
    return badRequest(res, 'Validation failed', errors);
  }
  next();
}

function validateSellerLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = {};

  if (!email || !email.trim()) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';

  if (Object.keys(errors).length > 0) {
    return badRequest(res, 'Validation failed', errors);
  }
  next();
}

function validateAdminLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = {};

  if (!email || !email.trim()) errors.email = 'Admin email is required';
  if (!password) errors.password = 'Admin password is required';

  if (Object.keys(errors).length > 0) {
    return badRequest(res, 'Validation failed', errors);
  }
  next();
}

function validateProduct(req, res, next) {
  const { name, description, categoryId, price, stockQuantity, sku } = req.body;
  const errors = {};

  if (!name || !name.trim()) errors.name = 'Product name is required';
  if (!description || !description.trim()) errors.description = 'Description is required';
  if (!categoryId) errors.categoryId = 'Category is required';
  if (price === undefined || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
    errors.price = 'Valid price is required';
  }
  if (stockQuantity === undefined || isNaN(parseInt(stockQuantity, 10)) || parseInt(stockQuantity, 10) < 0) {
    errors.stockQuantity = 'Valid stock quantity is required (>= 0)';
  }
  if (!sku || !sku.trim()) errors.sku = 'SKU is required';

  if (Object.keys(errors).length > 0) {
    return badRequest(res, 'Product validation failed', errors);
  }
  next();
}

module.exports = {
  validateCustomerRegister,
  validateCustomerLogin,
  validateSellerRegister,
  validateSellerLogin,
  validateAdminLogin,
  validateProduct
};
