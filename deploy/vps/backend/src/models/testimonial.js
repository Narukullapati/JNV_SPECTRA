const BaseModel = require('./BaseModel');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class Testimonial extends BaseModel {
  constructor() {
    super('testimonials');
  }

  async findAll(filters = {}) {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];
      let paramCount = 1;
      const conditions = [];

      // Apply filters
      if (filters.client_name) {
        conditions.push(`client_name ILIKE $${paramCount}`);
        params.push(`%${filters.client_name}%`);
        paramCount++;
      }
      if (filters.location) {
        conditions.push(`location ILIKE $${paramCount}`);
        params.push(`%${filters.location}%`);
        paramCount++;
      }
      if (filters.rating) {
        conditions.push(`rating = $${paramCount}`);
        params.push(filters.rating);
        paramCount++;
      }
      if (filters.status) {
        conditions.push(`status = $${paramCount}`);
        params.push(filters.status);
        paramCount++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Apply sorting
      if (filters.sortBy) {
        query += ` ORDER BY ${filters.sortBy} ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
      } else {
        query += ' ORDER BY created_at DESC';
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM ${this.tableName}${conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''}`;
      const countResult = await this.query(countQuery, params);
      const totalCount = parseInt(countResult[0]?.count || 0);

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const rows = await this.query(query, params);
      
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
      logger.error('Error in Testimonial.findAll:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id],
      );

      return rows[0];
    } catch (error) {
      logger.error('Error in Testimonial.findById:', error);
      throw error;
    }
  }

  async create(testimonialData) {
    try {
      const requiredFields = ['client_name', 'location', 'rating', 'feedback', 'featured_image_url'];
      const missingFields = requiredFields.filter((field) => !testimonialData[field]);
      
      if (missingFields.length > 0) {
        throw new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400);
      }

      const columns = Object.keys(testimonialData);
      const values = Object.values(testimonialData);
      const placeholders = values.map((_, i) => `$${i + 1}`);

      const query = `
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      const rows = await this.query(query, values);
      return rows[0];
    } catch (error) {
      logger.error('Error in Testimonial.create:', error);
      throw error;
    }
  }

  async update(id, testimonialData) {
    try {
      const setClauses = [];
      const params = [];
      let paramCount = 1;

      Object.entries(testimonialData).forEach(([key, value]) => {
        setClauses.push(`${key} = $${paramCount}`);
        params.push(value);
        paramCount++;
      });

      params.push(id);

      const query = `
        UPDATE ${this.tableName}
        SET ${setClauses.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const rows = await this.query(query, params);
      return rows[0];
    } catch (error) {
      logger.error('Error in Testimonial.update:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      await this.query(
        `DELETE FROM ${this.tableName} WHERE id = $1`,
        [id],
      );

      return true;
    } catch (error) {
      logger.error('Error in Testimonial.delete:', error);
      throw error;
    }
  }

  async getFeatured() {
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.tableName} 
         WHERE status = 'active' 
         ORDER BY rating DESC, created_at DESC 
         LIMIT 10`,
      );

      return rows;
    } catch (error) {
      logger.error('Error in Testimonial.getFeatured:', error);
      throw error;
    }
  }
}

module.exports = Testimonial; 