const TestimonialService = require('../services/testimonialService');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

const getAllTestimonials = async (req, res, next) => {
  try {
    const filters = {};
    
    // Add filters if they are provided
    if (req.query.client_name) {
      filters.client_name = req.query.client_name;
    }
    if (req.query.location) {
      filters.location = req.query.location;
    }
    if (req.query.rating) {
      filters.rating = parseInt(req.query.rating);
    }
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.page) {
      filters.page = parseInt(req.query.page);
    }
    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit);
    }
    if (req.query.sortBy) {
      filters.sortBy = req.query.sortBy;
    }
    if (req.query.sortOrder) {
      filters.sortOrder = req.query.sortOrder;
    }

    const testimonials = await TestimonialService.getAllTestimonials(filters);
    res.json({
      status: 'success',
      data: testimonials,
    });
  } catch (error) {
    logger.error('Error in getAllTestimonials:', error);
    next(error);
  }
};

const getTestimonialById = async (req, res, next) => {
  try {
    const testimonial = await TestimonialService.getTestimonialById(req.params.id);
    res.json({
      status: 'success',
      data: testimonial,
    });
  } catch (error) {
    logger.error(`Error in getTestimonialById for id ${req.params.id}:`, error);
    next(error);
  }
};

const createTestimonial = async (req, res, next) => {
  try {
    const requiredFields = ['client_name', 'location', 'rating', 'feedback', 'featured_image_url'];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
    
    if (missingFields.length > 0) {
      throw new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400);
    }

    // Validate rating
    if (req.body.rating < 1 || req.body.rating > 5) {
      throw new AppError('Rating must be between 1 and 5', 400);
    }

    const testimonial = await TestimonialService.createTestimonial(req.body);
    res.status(201).json({
      status: 'success',
      data: testimonial,
    });
  } catch (error) {
    logger.error('Error in createTestimonial:', error);
    next(error);
  }
};

const updateTestimonial = async (req, res, next) => {
  try {
    // Validate rating if provided
    if (req.body.rating && (req.body.rating < 1 || req.body.rating > 5)) {
      throw new AppError('Rating must be between 1 and 5', 400);
    }

    const testimonial = await TestimonialService.updateTestimonial(req.params.id, req.body);
    res.json({
      status: 'success',
      data: testimonial,
    });
  } catch (error) {
    logger.error(`Error in updateTestimonial for id ${req.params.id}:`, error);
    next(error);
  }
};

const deleteTestimonial = async (req, res, next) => {
  try {
    await TestimonialService.deleteTestimonial(req.params.id);
    res.json({
      status: 'success',
      message: 'Testimonial deleted successfully',
    });
  } catch (error) {
    logger.error(`Error in deleteTestimonial for id ${req.params.id}:`, error);
    next(error);
  }
};

const getFeaturedTestimonials = async (req, res, next) => {
  try {
    const testimonials = await TestimonialService.getFeaturedTestimonials();
    res.json({
      status: 'success',
      data: testimonials,
    });
  } catch (error) {
    logger.error('Error in getFeaturedTestimonials:', error);
    next(error);
  }
};

module.exports = {
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getFeaturedTestimonials,
}; 