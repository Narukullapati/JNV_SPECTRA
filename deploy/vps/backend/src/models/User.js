const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class User extends BaseModel {
  constructor() {
    super('users');
  }

  async findByEmail(email) {
    try {
      const rows = await this.query(
        'SELECT * FROM users WHERE email = $1',
        [email],
      );
      return rows[0] || null;
    } catch (error) {
      this.logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findByUsername(username) {
    try {
      const rows = await this.query(
        'SELECT * FROM users WHERE username = $1',
        [username],
      );
      return rows[0] || null;
    } catch (error) {
      this.logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  async create(userData) {
    try {
      // Create a copy of userData to avoid modifying the original
      const data = { ...userData };

      // Hash password before creating user
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 12);
      }

      // Set default role if not provided
      if (!data.role) {
        data.role = 'user';
      }

      this.logger.info('Creating user with data:', { ...data, password: '[REDACTED]' });

      // First check if user with same email or username exists
      const existingUsers = await this.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [data.email, data.username],
      );

      if (existingUsers && existingUsers.length > 0) {
        throw new Error('User with this email or username already exists');
      }

      // Insert new user
      const rows = await this.query(
        'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at, updated_at',
        [data.username, data.email, data.password, data.role],
      );

      if (!rows || rows.length === 0) {
        throw new Error('Failed to create user');
      }

      this.logger.info('User created successfully:', rows[0]);
      return rows[0];
    } catch (error) {
      this.logger.error('Error in User.create:', error);
      throw error;
    }
  }

  async update(id, userData) {
    try {
      // Create a copy of userData to avoid modifying the original
      const data = { ...userData };

      // Hash password if it's being updated
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 12);
      }

      return await super.update(id, data);
    } catch (error) {
      this.logger.error('Error in User.update:', error);
      throw error;
    }
  }

  async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      this.logger.error('Error in User.verifyPassword:', error);
      return false;
    }
  }
}

module.exports = new User();
