const BaseModel = require('./BaseModel');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class EventsHosted extends BaseModel {
  constructor() {
    super('events_hosted');
  }

  validateEventData(data) {
    if (!data.event_title) {
      throw new AppError('Event title is required', 400);
    }
    if (!data.event_date) {
      throw new AppError('Event date is required', 400);
    }
    if (!data.event_type) {
      throw new AppError('Event type is required', 400);
    }
    if (!data.short_description) {
      throw new AppError('Short description is required', 400);
    }
    if (!data.detailed_description) {
      throw new AppError('Detailed description is required', 400);
    }
    if (!data.location) {
      throw new AppError('Event location is required', 400);
    }
    if (data.rating !== undefined && (isNaN(data.rating) || data.rating < 0 || data.rating > 5)) {
      throw new AppError('Rating must be a number between 0 and 5', 400);
    }
  }

  async findById(id) {
    try {
      if (!id) {
        throw new AppError('Event ID is required', 400);
      }

      const rows = await this.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id],
      );

      if (!rows[0]) {
        throw new AppError('Event not found', 404);
      }

      return rows[0];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error in EventsHosted.findById:', error);
      throw new AppError('Error retrieving event', 500);
    }
  }

  async create(data) {
    try {
      this.validateEventData(data);

      const query = `
        INSERT INTO ${this.tableName} (
          event_title, event_date, event_type, short_description,
          detailed_description, featured_image, gallery_images,
          image_tags, status, feedback, rating
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const params = [
        data.event_title,
        data.event_date,
        data.event_type,
        data.short_description,
        data.detailed_description,
        data.featured_image,
        data.gallery_images || [],
        data.image_tags || [],
        data.status || 'active',
        data.feedback,
        data.rating,
      ];

      const rows = await this.query(query, params);

      if (!rows[0]) {
        throw new AppError('Failed to create event', 400);
      }

      return rows[0];
    } catch (error) {
      logger.error('Error in EventsHosted.create:', error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      if (data.event_title || data.event_date || data.event_type || 
          data.short_description || data.detailed_description) {
        this.validateEventData({ ...data, id });
      }

      const setClauses = [];
      const params = [];
      let paramCount = 1;

      // Handle JSON fields
      const jsonFields = ['gallery_images', 'image_tags'];
      
      Object.entries(data).forEach(([key, value]) => {
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

      setClauses.push(`updated_at = $${paramCount}`);
      params.push(new Date().toISOString());
      paramCount++;

      params.push(id);

      const query = `
        UPDATE ${this.tableName}
        SET ${setClauses.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const rows = await this.query(query, params);

      if (!rows[0]) {
        throw new AppError('Event not found', 404);
      }

      return rows[0];
    } catch (error) {
      logger.error('Error in EventsHosted.update:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      if (!id) {
        throw new AppError('Event ID is required', 400);
      }

      const rows = await this.query(
        `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`,
        [id],
      );

      if (!rows[0]) {
        throw new AppError('Event not found', 404);
      }

      return rows[0];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error in EventsHosted.delete:', error);
      throw new AppError('Error deleting event', 500);
    }
  }

  async findAll(filters = {}) {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];
      let paramCount = 1;
      const conditions = [];

      if (filters.event_type) {
        conditions.push(`event_type = $${paramCount}`);
        params.push(filters.event_type);
        paramCount++;
      }

      if (filters.status) {
        conditions.push(`status = $${paramCount}`);
        params.push(filters.status);
        paramCount++;
      }

      if (filters.start_date) {
        conditions.push(`event_date >= $${paramCount}`);
        params.push(filters.start_date);
        paramCount++;
      }

      if (filters.end_date) {
        conditions.push(`event_date <= $${paramCount}`);
        params.push(filters.end_date);
        paramCount++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Add sorting
      const sortField = filters.sort_by || 'event_date';
      const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${sortField} ${sortOrder}`;

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM ${this.tableName}` + 
        (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '');
      const countResult = await this.query(countQuery, params);
      const totalCount = parseInt(countResult[0].count);

      // Add pagination
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

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
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error in EventsHosted.findAll:', error);
      throw new AppError('Error retrieving events', 500);
    }
  }

  async findByUserId(userId) {
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.tableName} WHERE user_id = $1`,
        [userId],
      );

      return rows;
    } catch (error) {
      logger.error('Error in EventsHosted.findByUserId:', error);
      throw new AppError('Error retrieving events', 500);
    }
  }

  async findByStatus(status) {
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.tableName} WHERE status = $1`,
        [status],
      );

      return rows;
    } catch (error) {
      logger.error('Error in EventsHosted.findByStatus:', error);
      throw new AppError('Error retrieving events', 500);
    }
  }
}

module.exports = EventsHosted; 