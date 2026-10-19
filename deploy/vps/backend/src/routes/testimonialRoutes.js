const express = require('express');
const router = express.Router();
const {
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getFeaturedTestimonials,
} = require('../controllers/testimonialController');
const { auth, isAdmin } = require('../middleware/auth');
const { validateTestimonial } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/rateLimiter');

// Public routes
router.get('/', apiLimiter, getAllTestimonials);
router.get('/featured', apiLimiter, getFeaturedTestimonials);
router.get('/:id', apiLimiter, getTestimonialById);

// Protected routes (require authentication)
router.post('/', 
  apiLimiter,
  auth,
  validateTestimonial,
  createTestimonial,
);

router.put('/:id',
  apiLimiter,
  auth,
  isAdmin,
  validateTestimonial,
  updateTestimonial,
);

router.delete('/:id',
  apiLimiter,
  auth,
  isAdmin,
  deleteTestimonial,
);

module.exports = router; 