const BaseModel = require('./BaseModel');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class SliderSlide extends BaseModel {
  constructor() {
    super('slider_slides');
  }

  async findAll() {
    try {
      const rows = await this.query(
        `SELECT * FROM ${this.tableName} ORDER BY "order" ASC`,
      );

      return rows;
    } catch (error) {
      logger.error('Error in SliderSlide.findAll:', error);
      throw error;
    }
  }

  async findBySliderName(sliderName) {
    try {
      logger.info('findBySliderName called with:', { sliderName });
      
      if (!sliderName) {
        throw new AppError('Slider name is required', 400);
      }

      const query = `SELECT * FROM ${this.tableName} WHERE slider_name = $1 ORDER BY "order" ASC`;
      logger.info('Executing query:', { query, params: [sliderName] });

      const rows = await this.query(query, [sliderName]);
      logger.info('Query result:', { 
        count: rows?.length,
        rows: rows, 
      });

      return rows;
    } catch (error) {
      logger.error('Error in findBySliderName:', {
        error: error.message,
        stack: error.stack,
        sliderName,
      });
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
      logger.error('Error in SliderSlide.findById:', error);
      throw error;
    }
  }

  async create(slideData) {
    try {
      const columns = Object.keys(slideData).map((key) => 
        key === 'order' ? '"order"' : key,
      );
      const values = Object.values(slideData);
      const placeholders = values.map((_, i) => `$${i + 1}`);

      const query = `
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      const rows = await this.query(query, values);
      return rows[0];
    } catch (error) {
      logger.error('Error in SliderSlide.create:', error);
      throw error;
    }
  }

  async update(id, slideData) {
    try {
      const setClauses = [];
      const params = [];
      let paramCount = 1;

      Object.entries(slideData).forEach(([key, value]) => {
        const columnName = key === 'order' ? '"order"' : key;
        setClauses.push(`${columnName} = $${paramCount}`);
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
      logger.error('Error in SliderSlide.update:', error);
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
      logger.error('Error in SliderSlide.delete:', error);
      throw error;
    }
  }

  async reorderSlides(sliderName, newOrder) {
    try {
      // Use a transaction to ensure all updates succeed or fail together
      await this.query('BEGIN');

      try {
        for (let i = 0; i < newOrder.length; i++) {
          await this.query(
            `UPDATE ${this.tableName} SET "order" = $1 WHERE id = $2 AND slider_name = $3`,
            [i, newOrder[i], sliderName],
          );
        }

        await this.query('COMMIT');
        return { message: 'Slides reordered successfully' };
      } catch (error) {
        await this.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error('Error reordering slides:', error);
      throw new AppError('Error reordering slides', 500);
    }
  }
}

module.exports = SliderSlide; 