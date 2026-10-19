const { pool } = require('../config/database');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.logger = logger;
  }

  async findAll(filters = {}) {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];
      let paramCount = 1;

      // Apply filters
      const whereConditions = [];
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && key !== 'page' && key !== 'limit' && key !== 'sortBy' && key !== 'sortOrder') {
          whereConditions.push(`${key} = $${paramCount}`);
          params.push(value);
          paramCount++;
        }
      });

      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }

      // Apply sorting
      if (filters.sortBy) {
        query += ` ORDER BY ${filters.sortBy} ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
      }

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM ${this.tableName}`;
      const { rows: countRows } = await pool.query(countQuery);
      const totalCount = parseInt(countRows[0].count);

      const { rows } = await pool.query(query, params);

      return {
        data: rows || [],
        count: totalCount,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error finding all in ${this.tableName}:`, error);
      throw new AppError('Database error', 500);
    }
  }

  async findById(id) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id],
      );
      return rows[0] || null;
    } catch (error) {
      this.logger.error(`Error finding by id in ${this.tableName}:`, error);
      throw new AppError('Database error', 500);
    }
  }

  async create(data) {
    try {
      const columns = Object.keys(data).join(', ');
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const { rows } = await pool.query(
        `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
        values,
      );
      return rows[0];
    } catch (error) {
      this.logger.error(`Error creating in ${this.tableName}:`, error);
      throw new AppError('Database error', 500);
    }
  }

  async update(id, data) {
    try {
      const setClause = Object.keys(data)
        .map((key, i) => `${key} = $${i + 2}`)
        .join(', ');
      
      const values = [id, ...Object.values(data)];
      
      const { rows } = await pool.query(
        `UPDATE ${this.tableName} SET ${setClause} WHERE id = $1 RETURNING *`,
        values,
      );
      return rows[0] || null;
    } catch (error) {
      this.logger.error(`Error updating in ${this.tableName}:`, error);
      throw new AppError('Database error', 500);
    }
  }

  async delete(id) {
    try {
      const { rows } = await pool.query(
        `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`,
        [id],
      );
      return rows[0] || null;
    } catch (error) {
      this.logger.error(`Error deleting in ${this.tableName}:`, error);
      throw new AppError('Database error', 500);
    }
  }

  async query(sql, params = []) {
    try {
      const result = await pool.query(sql, params);
      return result.rows;
    } catch (error) {
      this.logger.error(`Error executing query in ${this.tableName}:`, error);
      throw new AppError(`Database error: ${error.message}`, 500);
    }
  }
}

module.exports = BaseModel; 