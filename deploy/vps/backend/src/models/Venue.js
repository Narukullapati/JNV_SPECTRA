const BaseModel = require('./BaseModel');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class Venue extends BaseModel {
  constructor() {
    super('venues');
  }

  validateVenueData(data) {
    if (!data.title) {
      throw new AppError('Venue title is required', 400);
    }
    if (!data.location) {
      throw new AppError('Venue location is required', 400);
    }
    if (!data.capacity) {
      throw new AppError('Venue capacity is required', 400);
    }
  }

  async create(data) {
    try {
      this.validateVenueData(data);

      // Handle JSON fields
      const jsonFields = ['bullet_points', 'additional_images'];
      const fields = [
        { name: 'title', value: data.title },
        { name: 'description', value: data.description },
        { name: 'location', value: data.location },
        { name: 'capacity', value: data.capacity },
        { name: 'featured_image', value: data.featured_image },
        { name: 'additional_images', value: data.additional_images || [] },
        { name: 'bullet_points', value: data.bullet_points || [] },
        { name: 'rating', value: data.rating },
        { name: 'space_preference', value: data.space_preference },
        { name: 'status', value: data.status || 'active' },
        { name: 'venue_type', value: data.venue_type },
      ];

      const columns = fields.map((f) => f.name);
      const values = fields.map(({ name, value }) => {
        if (jsonFields.includes(name)) {
          return Array.isArray(value) ? JSON.stringify(value) : value;
        }
        return value;
      });
      const placeholders = values.map((_, i) => `$${i + 1}${jsonFields.includes(columns[i]) ? '::jsonb' : ''}`);

      const query = `
        INSERT INTO venues (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      const rows = await this.query(query, values);
      return rows[0];
    } catch (error) {
      this.logger.error('Error in Venue.create:', error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      if (data.title || data.location || data.capacity) {
        this.validateVenueData({ ...data, id });
      }

      // Handle JSON fields
      const jsonFields = ['bullet_points', 'additional_images'];
      const setClauses = [];
      const params = [];
      let paramCount = 1;

      // Process each field
      const fields = [
        { name: 'title', value: data.title },
        { name: 'description', value: data.description },
        { name: 'location', value: data.location },
        { name: 'capacity', value: data.capacity },
        { name: 'featured_image', value: data.featured_image },
        { name: 'additional_images', value: data.additional_images || [] },
        { name: 'bullet_points', value: data.bullet_points || [] },
        { name: 'rating', value: data.rating },
        { name: 'space_preference', value: data.space_preference },
        { name: 'status', value: data.status || 'active' },
        { name: 'venue_type', value: data.venue_type },
      ];

      fields.forEach(({ name, value }) => {
        if (jsonFields.includes(name)) {
          // Ensure the value is properly formatted as JSON
          const jsonValue = Array.isArray(value) ? JSON.stringify(value) : value;
          setClauses.push(`${name} = $${paramCount}::jsonb`);
          params.push(jsonValue);
        } else {
          setClauses.push(`${name} = $${paramCount}`);
          params.push(value);
        }
        paramCount++;
      });

      params.push(id);

      const query = `
        UPDATE venues 
        SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING *
      `;

      console.log('Update query:', query);
      console.log('Update params:', params);

      const result = await this.query(query, params);

      // First check if the venue exists
      const venueExists = await this.findById(id);
      if (!venueExists) {
        throw new AppError(`Venue with id ${id} not found`, 404);
      }

      // If venue exists but no rows were returned, it means no changes were made
      if (!result || !result.rows || result.rows.length === 0) {
        return venueExists; // Return the existing venue data
      }

      return result.rows[0];
    } catch (error) {
      this.logger.error('Error in Venue.update:', error);
      throw error;
    }
  }

  async findByLocation(location) {
    try {
      const { rows } = await this.query(
        'SELECT * FROM venues WHERE location ILIKE $1',
        [`%${location}%`],
      );
      return rows;
    } catch (error) {
      this.logger.error('Error finding venues by location:', error);
      throw new AppError('Database error', 500);
    }
  }

  async findByCapacity(minCapacity) {
    try {
      // Convert capacity string to numeric range for comparison
      const capacityMap = {
        '50': 50,
        '100-200': 100,
        '200-500': 200,
        '500-1000': 500,
        '1000+': 1000,
      };

      const minCapacityValue = capacityMap[minCapacity] || 0;
      
      const { rows } = await this.query(
        'SELECT * FROM venues WHERE capacity >= $1',
        [minCapacity],
      );
      return rows;
    } catch (error) {
      this.logger.error('Error finding venues by capacity:', error);
      throw new AppError('Database error', 500);
    }
  }
}

module.exports = new Venue(); 