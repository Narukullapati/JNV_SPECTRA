const BaseModel = require('./BaseModel');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class EventPlanning extends BaseModel {
  constructor() {
    super('event_planning');
  }

  validateEventData(data) {
    if (!data.name && !data.title) {
      throw new AppError('Event name or title is required', 400);
    }
    if (!data.description) {
      throw new AppError('Description is required', 400);
    }
  }

  // Transform response to map name to title
  transformResponse(data) {
    if (!data) return null;
    const { name, ...rest } = data;
    return {
      ...rest,
      title: name,
    };
  }

  async findAll(filters = {}) {
    try {
      const result = await super.findAll(filters);
      return {
        ...result,
        data: result.data.map((row) => this.transformResponse(row)),
      };
    } catch (error) {
      logger.error('Error in EventPlanning.findAll:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      const row = await super.findById(id);
      return this.transformResponse(row);
    } catch (error) {
      logger.error('Error in EventPlanning.findById:', error);
      throw error;
    }
  }

  async create(data) {
    try {
      this.validateEventData(data);

      // Prepare the data with proper JSON handling
      const eventData = {
        name: data.title || data.name, // Accept either title or name
        description: data.description,
        pricing: data.pricing || 0,
        featured_image: data.featured_image || null,
        additional_images: data.additional_images ? JSON.stringify(data.additional_images) : '[]',
        bullet_points: data.bullet_points ? JSON.stringify(data.bullet_points) : '[]',
        status: data.status || 'active',
      };

      const columns = Object.keys(eventData);
      const values = Object.values(eventData);
      const placeholders = values.map((_, i) => `$${i + 1}`);

      const rows = await this.query(
        `INSERT INTO ${this.tableName} (${columns.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values,
      );

      if (!rows || rows.length === 0) {
        throw new AppError('Failed to create event planning', 400);
      }

      return this.transformResponse(rows[0]);
    } catch (error) {
      logger.error('Error in EventPlanning.create:', error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      if (data.title || data.name || data.description) {
        this.validateEventData({ name: data.title || data.name, description: data.description });
      }

      // Prepare the data with proper JSON handling
      const eventData = {
        name: data.title || data.name, // Accept either title or name
        description: data.description,
        pricing: data.pricing || 0,
        featured_image: data.featured_image || null,
        additional_images: data.additional_images ? JSON.stringify(data.additional_images) : '[]',
        bullet_points: data.bullet_points ? JSON.stringify(data.bullet_points) : '[]',
        status: data.status || 'active',
      };

      const columns = Object.keys(eventData);
      const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const values = [...Object.values(eventData), id];

      const rows = await this.query(
        `UPDATE ${this.tableName} 
         SET ${setClause}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${values.length}
         RETURNING *`,
        values,
      );

      if (!rows || rows.length === 0) {
        throw new AppError('Event planning not found', 404);
      }

      return this.transformResponse(rows[0]);
    } catch (error) {
      logger.error('Error in EventPlanning.update:', error);
      throw error;
    }
  }

  async findByUserId(userId) {
    try {
      const rows = await this.query(
        'SELECT * FROM event_planning WHERE user_id = $1',
        [userId],
      );
      return rows.map((row) => this.transformResponse(row));
    } catch (error) {
      logger.error('Error finding event planning by user ID:', error);
      throw new AppError('Database error', 500);
    }
  }

  async findByStatus(status) {
    try {
      const rows = await this.query(
        'SELECT * FROM event_planning WHERE status = $1',
        [status],
      );
      return rows.map((row) => this.transformResponse(row));
    } catch (error) {
      logger.error('Error finding event planning by status:', error);
      throw new AppError('Database error', 500);
    }
  }
}

module.exports = new EventPlanning(); 