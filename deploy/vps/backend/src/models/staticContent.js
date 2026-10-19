const BaseModel = require('./BaseModel');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class StaticContent extends BaseModel {
  constructor() {
    super('static_content');
  }

  async findAll() {
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`,
      );

      return rows;
    } catch (error) {
      logger.error('Error in StaticContent.findAll:', error);
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
      logger.error('Error in StaticContent.findById:', error);
      throw error;
    }
  }

  async findByType(section) {
    try {
      logger.info('Finding static content by type:', {
        section,
        query: `SELECT * FROM ${this.tableName} WHERE section = $1`,
        params: [section],
      });

      const rows = await this.query(
        `SELECT * FROM ${this.tableName} WHERE section = $1`,
        [section],
      );

      logger.info('Query results:', {
        found: rows.length > 0,
        rowCount: rows.length,
        firstRow: rows[0],
      });

      return rows[0];
    } catch (error) {
      logger.error('Error in StaticContent.findByType:', {
        error: error.message,
        stack: error.stack,
        section,
      });
      throw error;
    }
  }

  async create(contentData) {
    try {
      const columns = Object.keys(contentData);
      const values = Object.values(contentData);
      const placeholders = values.map((_, i) => `$${i + 1}`);

      const query = `
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      const rows = await this.query(query, values);
      return rows[0];
    } catch (error) {
      logger.error('Error in StaticContent.create:', error);
      throw error;
    }
  }

  async update(id, contentData) {
    try {
      const setClauses = [];
      const params = [];
      let paramCount = 1;

      Object.entries(contentData).forEach(([key, value]) => {
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
      logger.error('Error in StaticContent.update:', error);
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
      logger.error('Error in StaticContent.delete:', error);
      throw error;
    }
  }

  async updateByType(section, updates) {
    try {
      logger.info('Starting updateByType with:', {
        section,
        updates: JSON.stringify(updates, null, 2),
      });

      const setClauses = [];
      const params = [];
      let paramCount = 1;

      // Handle meta_data separately
      const { meta_data, ...otherUpdates } = updates;
      
      logger.info('Processing meta_data:', {
        meta_data: JSON.stringify(meta_data, null, 2),
        meta_dataType: typeof meta_data,
      });

      // Process non-meta_data fields
      Object.entries(otherUpdates).forEach(([key, value]) => {
        logger.info(`Processing field ${key}:`, {
          value,
          valueType: typeof value,
          isArray: Array.isArray(value),
        });
        setClauses.push(`${key} = $${paramCount}`);
        params.push(value);
        paramCount++;
      });

      // Process meta_data
      if (meta_data) {
        try {
          const metaDataString = JSON.stringify(meta_data);
          logger.info('Meta_data after stringify:', {
            metaDataString,
            isValidJSON: this.isValidJSON(metaDataString),
          });
          
          setClauses.push(`meta_data = $${paramCount}::jsonb`);
          params.push(metaDataString);
          paramCount++;
        } catch (error) {
          logger.error('Error processing meta_data:', {
            error: error.message,
            meta_data,
            stack: error.stack,
          });
          throw error;
        }
      }

      params.push(section);

      const query = `
        UPDATE ${this.tableName}
        SET ${setClauses.join(', ')}
        WHERE section = $${paramCount}
        RETURNING *
      `;

      logger.info('Final query and params:', {
        query,
        params: params.map((param, index) => ({
          index,
          value: param,
          type: typeof param,
        })),
      });

      const rows = await this.query(query, params);
      return rows[0];
    } catch (error) {
      logger.error('Error in StaticContent.updateByType:', {
        error: error.message,
        stack: error.stack,
        section,
        updates: JSON.stringify(updates, null, 2),
      });
      throw error;
    }
  }

  isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }
}

// Export an instance instead of the class
module.exports = new StaticContent(); 