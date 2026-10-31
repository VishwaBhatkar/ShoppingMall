// Standardized JSON Response Utility

function success(res, message = 'Success', data = null, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function created(res, message = 'Resource created successfully', data = null) {
  return success(res, message, data, 201);
}

function error(res, message = 'An error occurred', statusCode = 500, errors = null) {
  const payload = {
    success: false,
    message
  };
  if (errors) {
    payload.errors = errors;
  }
  return res.status(statusCode).json(payload);
}

function badRequest(res, message = 'Bad request', errors = null) {
  return error(res, message, 400, errors);
}

function unauthorized(res, message = 'Unauthorized access') {
  return error(res, message, 401);
}

function forbidden(res, message = 'Forbidden: insufficient permissions') {
  return error(res, message, 403);
}

function notFound(res, message = 'Requested resource not found') {
  return error(res, message, 404);
}

module.exports = {
  success,
  created,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound
};
