const Joi = require('joi');
const { AppError } = require('../utils/AppError');

// ... existing validation schemas ...

const testimonialSchema = Joi.object({
  client_name: Joi.string().required().min(2).max(100),
  location: Joi.string().required().min(2).max(100),
  rating: Joi.number().integer().required().min(1).max(5),
  feedback: Joi.string().required().min(10).max(1000),
  featured_image_url: Joi.string().required().pattern(/^https?:\/\/.+/).messages({
    'string.pattern.base': 'Featured image URL must be a valid HTTP/HTTPS URL',
  }),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const testimonialUpdateSchema = testimonialSchema.keys({
  id: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
  ).required(),
  created_at: Joi.any().strip(),
  updated_at: Joi.any().strip(),
});

const validateTestimonial = (req, res, next) => {
  const schema = req.method === 'PUT' ? testimonialUpdateSchema : testimonialSchema;
  const { error } = schema.validate(req.body);
  if (error) {
    const message = error.details.map((detail) => detail.message).join(', ');
    throw new AppError(message, 400);
  }
  next();
};

const staticContentSchema = Joi.object({
  section: Joi.string().required().min(2).max(100),
  title: Joi.string().max(255).allow('', null),
  content: Joi.string().allow('', null),
  images: Joi.array().items(Joi.string().uri()).default([]),
  meta_data: Joi.object().default({}),
});

const sliderSlideSchema = Joi.object({
  slider_name: Joi.string().required().min(2).max(100),
  title: Joi.string().max(255).allow('', null),
  subtitle: Joi.string().max(255).allow('', null),
  content: Joi.string().allow('', null),
  image_url: Joi.string().required().uri(),
  cta_text: Joi.string().max(100).allow('', null),
  cta_link: Joi.string().uri().allow('', null),
  order: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const validateStaticContent = (req, res, next) => {
  const { error } = staticContentSchema.validate(req.body);
  if (error) {
    const message = error.details.map((detail) => detail.message).join(', ');
    throw new AppError(message, 400);
  }
  next();
};

const validateSliderSlide = (req, res, next) => {
  const { error } = sliderSlideSchema.validate(req.body);
  if (error) {
    const message = error.details.map((detail) => detail.message).join(', ');
    throw new AppError(message, 400);
  }
  next();
};

const validateGallery = (req, res, next) => {
  const { title, tagline, images } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Title is required and must be a non-empty string',
    });
  }

  if (!tagline || typeof tagline !== 'string' || tagline.trim().length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Tagline is required and must be a non-empty string',
    });
  }

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Images are required and must be a non-empty array',
    });
  }

  // Validate each image URL
  for (const image of images) {
    if (typeof image !== 'string' || !image.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Each image must be a valid URL string',
      });
    }
  }

  next();
};

module.exports = {
  validateTestimonial,
  validateStaticContent,
  validateSliderSlide,
  validateGallery,
}; 