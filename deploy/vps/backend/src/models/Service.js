const BaseModel = require('./BaseModel');
const { setupLogger } = require('../utils/logger');
const { pool } = require('../config/database');

const logger = setupLogger();

class Service extends BaseModel {
  constructor() {
    super('services');
  }

  async findAll(filters = {}) {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      let countQuery = `SELECT COUNT(*) FROM ${this.tableName}`;
      const params = [];
      let paramCount = 1;

      // Apply filters
      if (filters.status) {
        query += ` WHERE status = $${paramCount}`;
        countQuery += ` WHERE status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
      }

      // Apply sorting
      if (filters.sortBy) {
        query += ` ORDER BY ${filters.sortBy} ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
      }

      // Get total count
      const countResult = await this.query(countQuery, params);
      const totalCount = parseInt(countResult[0].count);

      // Apply pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(totalCount / limit);

      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const rows = await this.query(query, params);
      
      return {
        data: rows,
        count: totalCount,
        pagination: {
          page: page.toString(),
          limit: limit.toString(),
          totalPages: totalPages,
        },
      };
    } catch (error) {
      logger.error('Error in Service.findAll:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id],
      );
      return rows[0] || null;
    } catch (error) {
      logger.error('Error in Service.findById:', error);
      throw error;
    }
  }

  async create(serviceData) {
    try {
      const columns = Object.keys(serviceData);
      const values = Object.values(serviceData);
      const placeholders = values.map((_, i) => `$${i + 1}`);

      // Handle JSON fields
      const jsonFields = ['bullet_points', 'additional_images'];
      const setClauses = columns.map((col, i) => {
        if (jsonFields.includes(col)) {
          return `${col} = $${i + 1}::jsonb`;
        }
        return `${col} = $${i + 1}`;
      });

      const query = `
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      // Ensure JSON fields are properly formatted
      const formattedValues = values.map((value, i) => {
        if (jsonFields.includes(columns[i])) {
          return JSON.stringify(value);
        }
        return value;
      });

      const rows = await this.query(query, formattedValues);
      return rows[0];
    } catch (error) {
      logger.error('Error in Service.create:', error);
      throw error;
    }
  }

  async update(id, serviceData) {
    try {
      const setClauses = [];
      const params = [];
      let paramCount = 1;

      // Handle JSON fields
      const jsonFields = ['bullet_points', 'additional_images'];
      
      Object.entries(serviceData).forEach(([key, value]) => {
        if (jsonFields.includes(key)) {
          // Ensure the value is properly formatted as JSON
          const jsonValue = Array.isArray(value) ? JSON.stringify(value) : value;
          setClauses.push(`${key} = $${paramCount}::jsonb`);
          params.push(jsonValue);
        } else {
          setClauses.push(`${key} = $${paramCount}`);
          params.push(value);
        }
        paramCount++;
      });

      params.push(id);

      const query = `
        UPDATE ${this.tableName}
        SET ${setClauses.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      console.log('Update query:', query);
      console.log('Update params:', params);

      const rows = await this.query(query, params);
      return rows[0];
    } catch (error) {
      logger.error('Error in Service.update:', error);
      throw error;
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
      logger.error('Error in Service.delete:', error);
      throw error;
    }
  }

  async findByCategory(category, options = {}) {
    try {
      let query = `SELECT * FROM ${this.tableName} WHERE category = $1 AND status = 'active'`;
      const params = [category];
      let paramCount = 2;

      if (options.orderBy) {
        query += ` ORDER BY ${options.orderBy.column} ${options.orderBy.ascending ? 'ASC' : 'DESC'}`;
      }

      if (options.limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(options.limit);
        paramCount++;
      }

      if (options.offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(options.offset);
      }

      const rows = await this.query(query, params);
      return rows;
    } catch (error) {
      logger.error('Error in Service.findByCategory:', error);
      throw error;
    }
  }

  async findFeatured(limit = 3) {
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.tableName} 
         WHERE status = 'active' 
         ORDER BY created_at DESC 
         LIMIT $1`,
        [limit],
      );

      return rows;
    } catch (error) {
      logger.error('Error in Service.findFeatured:', error);
      throw error;
    }
  }
}

module.exports = Service; 