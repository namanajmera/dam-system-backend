const multer = require('multer');

const errorHandler = (err, req, res, next) => {
  console.error('Error details:', {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack
  });

  // Handle Multer errors
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'File size limit exceeded',
          details: `Maximum file size allowed is ${(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024) / (1024 * 1024)}MB`
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Unexpected field',
          details: 'Please use the correct field name for file upload'
        });
      default:
        return res.status(400).json({
          error: 'File upload error',
          details: err.message
        });
    }
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  // Handle file system errors
  if (err.code === 'ENOENT') {
    return res.status(500).json({
      error: 'File System Error',
      details: 'Error accessing the file system'
    });
  }

  // Handle other errors
  res.status(500).json({
    error: 'Internal Server Error',
    details: err.message || 'An unexpected error occurred'
  });
};

module.exports = errorHandler; 