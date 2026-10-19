const jwt = require('jsonwebtoken');
const { setupLogger } = require('./logger');

const logger = setupLogger();

const generateToken = (payload) => {
  try {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });
  } catch (error) {
    logger.error('Error generating token:', error);
    throw error;
  }
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    logger.error('Error verifying token:', error);
    throw error;
  }
};

module.exports = {
  generateToken,
  verifyToken,
}; 