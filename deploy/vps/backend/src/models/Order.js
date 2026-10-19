const BaseModel = require('./BaseModel');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

// Validation helper functions
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhoneNumber = (phone) => {
  // Remove all non-digit characters except + to count actual digits
  const digitsOnly = phone.replace(/[^\d+]/g, '');
  
  // Check if it starts with + and has country code
  if (phone.startsWith('+')) {
    // Should have 1-3 digits for country code followed by exactly 10 digits
    return /^\+\d{1,3}\d{10}$/.test(digitsOnly);
  }
  
  // If no country code, should have exactly 10 digits
  return /^\d{10}$/.test(digitsOnly);
};

const isValidDate = (date) => {
  return !isNaN(Date.parse(date));
};

const isValidTime = (time) => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

const isValidPaymentOption = (option) => {
  return ['paid_offline', 'online'].includes(option);
};

class Order extends BaseModel {
  constructor() {
    super('orders');
  }

  validateOrderData(data) {
    const requiredFields = [
      'customer_name',
      'email',
      'contact_number',
      'event_date',
      'event_time',
      'order_details',
      'payment_option',
      'total_amount',
      'deposit_amount',
      'balance_amount',
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new AppError(`Missing required field: ${field}`, 400);
      }
    }

    if (!isValidEmail(data.email)) {
      throw new AppError('Invalid email format', 400);
    }

    if (!isValidPhoneNumber(data.contact_number)) {
      throw new AppError('Invalid phone number format', 400);
    }

    if (!isValidDate(data.event_date)) {
      throw new AppError('Invalid event date format', 400);
    }

    if (!isValidTime(data.event_time)) {
      throw new AppError('Invalid event time format', 400);
    }

    if (!isValidPaymentOption(data.payment_option)) {
      throw new AppError('Invalid payment option', 400);
    }

    if (typeof data.total_amount !== 'number' || data.total_amount <= 0) {
      throw new AppError('Invalid total amount', 400);
    }

    if (typeof data.deposit_amount !== 'number' || data.deposit_amount < 0) {
      throw new AppError('Invalid deposit amount', 400);
    }

    if (typeof data.balance_amount !== 'number' || data.balance_amount < 0) {
      throw new AppError('Invalid balance amount', 400);
    }

    if (data.deposit_amount + data.balance_amount !== data.total_amount) {
      throw new AppError('Deposit and balance amounts must sum to total amount', 400);
    }

    // Validate service quantities
    if (data.order_details && data.order_details.items) {
      for (const item of data.order_details.items) {
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          throw new AppError('Invalid quantity for service: ' + item.name, 400);
        }
      }
    }
  }

  async findById(id) {
    try {
      if (!id) {
        throw new AppError('Order ID is required', 400);
      }

      const rows = await this.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        [id],
      );

      if (!rows[0]) {
        throw new AppError('Order not found', 404);
      }

      return rows[0];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error in Order.findById:', error);
      throw new AppError('Error retrieving order', 500);
    }
  }

  async create(data) {
    try {
      this.validateOrderData(data);

      const {
        customer_name,
        email,
        contact_number,
        event_date,
        event_time,
        order_details,
        payment_option,
        total_amount,
        deposit_amount,
        balance_amount,
        order_status = 'pending',
        payment_id = null,
        payment_details = null,
        quotation_template = null,
        invoice_template = null,
        deposit_payment_link = null,
        balance_payment_link = null,
        deposit_paid_at = null,
        balance_paid_at = null,
      } = data;

      const result = await this.query(
        `INSERT INTO ${this.tableName} (
          customer_name, email, contact_number, event_date, event_time,
          order_details, payment_option, order_status, payment_id,
          payment_details, quotation_template, invoice_template,
          total_amount, deposit_amount, balance_amount,
          deposit_payment_link, balance_payment_link,
          deposit_paid_at, balance_paid_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *`,
        [
          customer_name, email, contact_number, event_date, event_time,
          order_details, payment_option, order_status, payment_id,
          payment_details, quotation_template, invoice_template,
          total_amount, deposit_amount, balance_amount,
          deposit_payment_link, balance_payment_link,
          deposit_paid_at, balance_paid_at,
        ],
      );

      return result[0];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error creating order:', error);
      throw new AppError('Error creating order', 500);
    }
  }

  async update(id, data) {
    try {
      if (!id) {
        throw new AppError('Order ID is required', 400);
      }

      const needsValidation = data.customer_name || data.email || data.payment_option;
      
      if (needsValidation) {
        this.validateOrderData({ ...data, id });
      }

      const setClauses = [];
      const params = [];
      let paramCount = 1;

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          setClauses.push(`${key} = $${paramCount}`);
          params.push(value);
          paramCount++;
        }
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
        throw new AppError('Order not found', 404);
      }

      return rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new AppError('An order with similar details already exists', 409);
      }
      logger.error('Error in Order.update:', error);
      throw new AppError('Error updating order', 500);
    }
  }

  async delete(id) {
    try {
      if (!id) {
        throw new AppError('Order ID is required', 400);
      }

      const rows = await this.query(
        `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`,
        [id],
      );

      if (!rows[0]) {
        throw new AppError('Order not found', 404);
      }

      return rows[0];
    } catch (error) {
      logger.error('Error in Order.delete:', error);
      throw new AppError('Error deleting order', 500);
    }
  }

  async findAll(filters = {}) {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];
      let paramCount = 1;
      const conditions = [];

      if (filters.email) {
        conditions.push(`email = $${paramCount}`);
        params.push(filters.email);
        paramCount++;
      }

      if (filters.order_status) {
        const orderStatuses = Array.isArray(filters.order_status)
          ? filters.order_status
          : String(filters.order_status)
            .split(',')
            .map((status) => status.trim())
            .filter(Boolean);

        if (orderStatuses.length === 1) {
          conditions.push(`order_status = $${paramCount}`);
          params.push(orderStatuses[0]);
          paramCount++;
        } else if (orderStatuses.length > 1) {
          conditions.push(`order_status = ANY($${paramCount})`);
          params.push(orderStatuses);
          paramCount++;
        }
      }

      if (filters.service_type) {
        conditions.push(`service_type = $${paramCount}`);
        params.push(filters.service_type);
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

      if (filters.created_at_gte) {
        conditions.push(`created_at >= $${paramCount}`);
        params.push(filters.created_at_gte);
        paramCount++;
      }

      if (filters.created_at_gt) {
        conditions.push(`created_at > $${paramCount}`);
        params.push(filters.created_at_gt);
        paramCount++;
      }

      if (filters.created_at_lte) {
        conditions.push(`created_at <= $${paramCount}`);
        params.push(filters.created_at_lte);
        paramCount++;
      }

      if (filters.created_at_lt) {
        conditions.push(`created_at < $${paramCount}`);
        params.push(filters.created_at_lt);
        paramCount++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Add sorting
      const sortField = filters.sort_by || 'created_at';
      const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${sortField} ${sortOrder}`;

      // Add pagination
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
      logger.error('Error in Order.findAll:', error);
      throw new AppError('Error retrieving orders', 500);
    }
  }
}

module.exports = Order; 
