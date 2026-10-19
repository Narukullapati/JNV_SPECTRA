const Testimonial = require('../models/testimonial');
const { setupLogger } = require('../utils/logger');
const EmailService = require('./emailService');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class TestimonialService {
  constructor() {
    this.testimonialModel = new Testimonial();
  }

  async getAllTestimonials(filters = {}) {
    try {
      const testimonials = await this.testimonialModel.findAll(filters);
      return testimonials;
    } catch (error) {
      logger.error('Error fetching testimonials:', error);
      throw error;
    }
  }

  async getTestimonialById(id) {
    try {
      const testimonial = await this.testimonialModel.findById(id);
      if (!testimonial) {
        throw new AppError('Testimonial not found', 404);
      }
      return testimonial;
    } catch (error) {
      logger.error(`Error fetching testimonial ${id}:`, error);
      throw error;
    }
  }

  async createTestimonial(data) {
    try {
      const testimonial = await this.testimonialModel.create(data);
      return testimonial;
    } catch (error) {
      logger.error('Error creating testimonial:', error);
      throw error;
    }
  }

  async updateTestimonial(id, data) {
    try {
      const testimonial = await this.testimonialModel.update(id, data);
      if (!testimonial) {
        throw new AppError('Testimonial not found', 404);
      }
      return testimonial;
    } catch (error) {
      logger.error(`Error updating testimonial ${id}:`, error);
      throw error;
    }
  }

  async deleteTestimonial(id) {
    try {
      const result = await this.testimonialModel.delete(id);
      if (!result) {
        throw new AppError('Testimonial not found', 404);
      }
      return result;
    } catch (error) {
      logger.error(`Error deleting testimonial ${id}:`, error);
      throw error;
    }
  }

  async triggerReviewRequest(order) {
    try {
      // Check if a testimonial already exists for this order
      const testimonials = await this.testimonialModel.findAll({
        related_object_type: 'event',
        related_object_id: order.id,
      });

      if (testimonials && testimonials.length > 0) {
        throw new AppError('Review request already sent for this order', 400);
      }

      // Send review request email
      await EmailService.sendReviewRequestEmail(order);

      logger.info(`Review request triggered for order ${order.id}`);
      return { message: 'Review request sent successfully' };
    } catch (error) {
      logger.error('Error triggering review request:', error);
      throw error;
    }
  }

  async getFeaturedTestimonials() {
    try {
      const testimonials = await this.testimonialModel.getFeatured();
      return testimonials;
    } catch (error) {
      logger.error('Error fetching featured testimonials:', error);
      throw error;
    }
  }
}

module.exports = new TestimonialService(); 