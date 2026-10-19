const Joi = require('joi');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).required().messages({
    'string.min': 'Username must be at least 3 characters long',
    'string.max': 'Username must not exceed 30 characters',
    'any.required': 'Username is required',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required',
  }),
  role: Joi.string().valid('user', 'admin').default('user').messages({
    'any.only': 'Role must be either "user" or "admin"',
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'Password is required',
  }),
});

const updateProfileSchema = Joi.object({
  username: Joi.string().min(3).max(30).messages({
    'string.min': 'Username must be at least 3 characters long',
    'string.max': 'Username must not exceed 30 characters',
  }),
  email: Joi.string().email().messages({
    'string.email': 'Please enter a valid email address',
  }),
  password: Joi.string().min(6).messages({
    'string.min': 'Password must be at least 6 characters long',
  }),
});

const serviceSchema = Joi.object({
  title: Joi.string().required().min(3).max(255).messages({
    'string.empty': 'Title is required',
    'string.min': 'Title must be at least 3 characters long',
    'string.max': 'Title must not exceed 255 characters',
  }),
  description: Joi.string().required().min(10).messages({
    'string.empty': 'Description is required',
    'string.min': 'Description must be at least 10 characters long',
  }),
  featured_image: Joi.string().uri().messages({
    'string.uri': 'Featured image must be a valid URL',
  }),
  additional_images: Joi.array().items(Joi.string().uri()).messages({
    'array.base': 'Additional images must be an array',
    'string.uri': 'Each additional image must be a valid URL',
  }),
  bullet_points: Joi.array().items(Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
  })).messages({
    'array.base': 'Bullet points must be an array',
    'object.base': 'Each bullet point must be an object with title and description',
  }),
  status: Joi.string().valid('active', 'inactive').default('active').messages({
    'string.base': 'Status must be a string',
    'any.only': 'Status must be either active or inactive',
  }),
});

const updateServiceSchema = serviceSchema.fork(
  ['title', 'description'],
  (schema) => schema.optional(),
);

const rentalSchema = Joi.object({
  title: Joi.string().required().messages({
    'string.empty': 'Title is required',
    'any.required': 'Title is required',
  }),
  description: Joi.string().required().messages({
    'string.empty': 'Description is required',
    'any.required': 'Description is required',
  }),
  featured_image: Joi.string().uri().allow(''),
  gallery_images: Joi.array().items(Joi.string().uri()),
  bullet_points: Joi.array().items(
    Joi.object({
      key: Joi.string().required(),
      value: Joi.string().required(),
    }),
  ),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const updateRentalSchema = Joi.object({
  title: Joi.string(),
  description: Joi.string(),
  featured_image: Joi.string().uri().allow(''),
  gallery_images: Joi.array().items(Joi.string().uri()),
  bullet_points: Joi.array().items(
    Joi.object({
      key: Joi.string().required(),
      value: Joi.string().required(),
    }),
  ),
  status: Joi.string().valid('active', 'inactive'),
});

const eventPlanningSchema = Joi.object({
  name: Joi.string().min(3).max(100),
  title: Joi.string().min(3).max(100),
  description: Joi.string().required().min(10).max(1000),
  pricing: Joi.number().min(0).optional(),
  featured_image: Joi.string().uri().optional(),
  additional_images: Joi.array().items(Joi.string().uri()).optional(),
  bullet_points: Joi.array().items(
    Joi.object({
      label: Joi.string().required(),
      value: Joi.string().required(),
    }),
  ).optional(),
  status: Joi.string().valid('active', 'inactive').default('active'),
}).custom((value, helpers) => {
  if (!value.name && !value.title) {
    return helpers.error('any.required', { message: '"name" or "title" is required' });
  }
  return value;
});

const venueSchema = Joi.object({
  title: Joi.string().required().messages({
    'string.empty': 'Title is required',
    'any.required': 'Title is required',
  }),
  description: Joi.string().required().messages({
    'string.empty': 'Description is required',
    'any.required': 'Description is required',
  }),
  location: Joi.string().required().messages({
    'string.empty': 'Location is required',
    'any.required': 'Location is required',
  }),
  capacity: Joi.string().valid('50', '100-200', '200-500', '500-1000', '1000+').required().messages({
    'any.only': 'Capacity must be one of: 50, 100-200, 200-500, 500-1000, 1000+',
    'any.required': 'Capacity is required',
  }),
  venue_type: Joi.string().valid('banquet halls', 'Garden and Outdoor venues', 'Resorts', 'Roof top', 'Beach front venues').required().messages({
    'any.only': 'Venue type must be one of: banquet halls, Garden and Outdoor venues, Resorts, Roof top, Beach front venues',
    'any.required': 'Venue type is required',
  }),
  space_preference: Joi.string().valid('indoor', 'outdoor', 'both').required().messages({
    'any.only': 'Space preference must be one of: indoor, outdoor, both',
    'any.required': 'Space preference is required',
  }),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.base': 'Rating must be a number',
    'number.integer': 'Rating must be an integer',
    'number.min': 'Rating must be at least 1',
    'number.max': 'Rating must be at most 5',
    'any.required': 'Rating is required',
  }),
  featured_image: Joi.string().uri().allow(''),
  gallery_images: Joi.array().items(Joi.string().uri()),
  bullet_points: Joi.array().items(
    Joi.object({
      label: Joi.string().required(),
      value: Joi.string().required(),
    }),
  ),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

const updateVenueSchema = Joi.object({
  title: Joi.string(),
  description: Joi.string(),
  location: Joi.string(),
  capacity: Joi.string().valid('50', '100-200', '200-500', '500-1000', '1000+'),
  venue_type: Joi.string().valid('banquet halls', 'Garden and Outdoor venues', 'Resorts', 'Roof top', 'Beach front venues'),
  space_preference: Joi.string().valid('indoor', 'outdoor', 'both'),
  rating: Joi.number().integer().min(1).max(5),
  featured_image: Joi.string().uri().allow(''),
  gallery_images: Joi.array().items(Joi.string().uri()),
  bullet_points: Joi.array().items(
    Joi.object({
      label: Joi.string().required(),
      value: Joi.string().required(),
    }),
  ),
  status: Joi.string().valid('active', 'inactive'),
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      logger.error('Validation error:', errorMessages);
      return res.status(400).json({
        error: 'Validation error',
        messages: errorMessages,
      });
    }

    next();
  };
};

module.exports = {
  validate,
  loginSchema,
  updateProfileSchema,
  registerSchema,
  serviceSchema,
  updateServiceSchema,
  rentalSchema,
  updateRentalSchema,
  eventPlanningSchema,
  venueSchema,
  updateVenueSchema,
}; 