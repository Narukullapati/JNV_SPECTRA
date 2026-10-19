const jwt = process.env.NODE_ENV === 'test' 
  ? require('../tests/mocks/jwt')
  : require('jsonwebtoken');
const User = process.env.NODE_ENV === 'test' ? require('../tests/mocks/User') : require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { setupLogger } = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { getUser } = require('../utils/getUser');

const logger = setupLogger();

const signToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '90d' },
  );
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

const register = async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      throw new AppError('Username, email, and password are required', 400);
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      role: role || 'user',
    });

    // Remove password from response
    delete user.password;

    res.status(201).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    
    if (error.message.includes('already exists')) {
      next(new AppError(error.message, 409));
    } else {
      next(error);
    }
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password!', 400));
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return next(new AppError('Incorrect email or password', 401));
    }

    const isPasswordCorrect = process.env.NODE_ENV === 'test' 
      ? password === user.password 
      : await User.verifyPassword(password, user.password);

    if (!isPasswordCorrect) {
      return next(new AppError('Incorrect email or password', 401));
    }

    const token = signToken(user.id);

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'You are not logged in',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUser().findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User no longer exists',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token',
      });
    }
    next(error);
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  };
};

exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user
    const user = await getUser().findById(req.user.id);

    // Check current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await getUser().update(user.id, { password: hashedPassword });

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          role: req.user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await User.update(req.user.id, req.body);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
}; 