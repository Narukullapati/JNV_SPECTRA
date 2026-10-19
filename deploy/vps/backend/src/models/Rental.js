const BaseModel = require('./BaseModel');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class Rental extends BaseModel {
  constructor() {
    super('rentals');
  }

  async findAll(filters = {}) {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];
      let paramCount = 1;
      const conditions = [];

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && key !== 'page' && key !== 'limit' && key !== 'sortBy' && key !== 'sortOrder') {
          conditions.push(`${key} = $${paramCount}`);
          params.push(value);
          paramCount++;
        }
      });

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Apply sorting
      if (filters.sortBy) {
        const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${filters.sortBy} ${sortOrder}`;
      }

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM ${this.tableName}` + 
        (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '');
      const countResult = await this.query(countQuery, params.slice(0, -2));
      const totalCount = parseInt(countResult[0].count);

      const rows = await this.query(query, params);

      return {
        data: rows,
        count: totalCount,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error('Error in Rental.findAll:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id],
      );

      if (!rows[0]) {
        throw new AppError('Rental not found', 404);
      }

      return rows[0];
    } catch (error) {
      logger.error('Error in Rental.findById:', error);
      throw error;
    }
  }

  async create(rentalData) {
    try {
      logger.info('Creating rental with data:', rentalData);

      const columns = [];
      const values = [];
      const placeholders = [];
      let paramCount = 1;

      // Handle JSON fields
      const jsonFields = ['bullet_points', 'gallery_images'];

      Object.entries(rentalData).forEach(([key, value]) => {
        columns.push(key);
        if (jsonFields.includes(key)) {
          // Ensure the value is properly formatted as JSON
          const jsonValue = Array.isArray(value) ? JSON.stringify(value) : value;
          values.push(jsonValue);
          placeholders.push(`$${paramCount}::jsonb`);
        } else {
          values.push(value);
          placeholders.push(`$${paramCount}`);
        }
        paramCount++;
      });

      const query = `
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      console.log('Create query:', query);
      console.log('Create params:', values);

      const rows = await this.query(query, values);

      if (!rows[0]) {
        throw new AppError('Failed to create rental', 400);
      }

      logger.info('Rental created successfully:', rows[0]);
      return rows[0];
    } catch (error) {
      logger.error('Error in Rental.create:', error);
      throw error;
    }
  }

  async update(id, rentalData) {
    try {
      logger.info(`Updating rental ${id} with data:`, rentalData);

      const setClauses = [];
      const params = [];
      let paramCount = 1;

      // Handle JSON fields
      const jsonFields = ['bullet_points', 'gallery_images'];
      
      Object.entries(rentalData).forEach(([key, value]) => {
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

      if (!rows[0]) {
        throw new AppError('Rental not found', 404);
      }

      logger.info('Rental updated successfully:', rows[0]);
      return rows[0];
    } catch (error) {
      logger.error('Error in Rental.update:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      logger.info(`Deleting rental ${id}`);

      await this.query(
        `DELETE FROM ${this.tableName} WHERE id = $1`,
        [id],
      );

      logger.info('Rental deleted successfully');
    } catch (error) {
      logger.error('Error in Rental.delete:', error);
      throw error;
    }
  }
}

module.exports = Rental; 