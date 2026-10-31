const { error } = require('../utils/responseUtils');

function errorHandler(err, req, res, next) {
  console.error('[Error]', err);

  // Handle Multer errors
  if (err.name === 'MulterError') {
    return error(res, `File upload error: ${err.message}`, 400);
  }

  // Handle MySQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    return error(res, 'A record with this information already exists (duplicate key)', 409);
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return error(res, 'Referenced record does not exist', 400);
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return error(res, 'Cannot delete or update record because other records depend on it', 400);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return error(res, message, statusCode);
}

module.exports = errorHandler;
