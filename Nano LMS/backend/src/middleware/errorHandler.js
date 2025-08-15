const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let statusCode = 500;
  let message = 'Internal Server Error';
  let error = 'Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    error = err.message;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    error = 'The provided ID is not valid';
  } else if (err.code === '23505') { // PostgreSQL unique constraint violation
    statusCode = 409;
    message = 'Duplicate entry';
    error = 'A record with this information already exists';
  } else if (err.code === '23503') { // PostgreSQL foreign key constraint violation
    statusCode = 400;
    message = 'Reference error';
    error = 'Cannot delete this record as it is referenced by other records';
  } else if (err.message && err.message.includes('not found')) {
    statusCode = 404;
    message = 'Resource not found';
    error = err.message;
  } else if (err.status) {
    statusCode = err.status;
    message = err.message || 'Request failed';
    error = err.error || 'Request Error';
  }

  // Send error response
  res.status(statusCode).json({
    error,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler };
