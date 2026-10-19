const jwt = process.env.NODE_ENV === 'test' 
  ? require('../tests/mocks/jwt')
  : require('jsonwebtoken');
const { AppError } = require('../utils/AppError');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

// Import User model based on environment
const User = process.env.NODE_ENV === 'test'
  ? require('../tests/mocks/User')
  : require('../models/User');

const protect = async (req, res, next) => {
  try {
    // 1) Get token and check if it exists
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');

    logger.info('Token decoded:', decoded);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);

    logger.info('Current user:', currentUser);

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // 4) Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again!', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired! Please log in again.', 401));
    }
    next(error);
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role || !roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };
};

// Create auth and isAdmin middleware
const auth = protect;
const isAdmin = restrictTo('admin');

module.exports = {
  protect,
  restrictTo,
  auth,
  isAdmin,
}; 