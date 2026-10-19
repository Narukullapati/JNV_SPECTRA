const express = require('express');
const authRoutes = require('./auth');
const serviceRoutes = require('./serviceRoutes');
const rentalRoutes = require('./rentals');
const eventPlanningRoutes = require('./eventPlanning');
const eventsHostedRoutes = require('./eventsHosted');
const orderRoutes = require('./orders');
const testimonialRoutes = require('./testimonialRoutes');
const staticContentRoutes = require('./staticContentRoutes');
const sliderSlideRoutes = require('./sliderSlideRoutes');
const analyticsRoutes = require('./analytics');
const venueRoutes = require('./venueRoutes');
const webhookRoutes = require('./webhooks');
const galleryRoutes = require('./galleryRoutes');

const router = express.Router();

// API version prefix
const API_PREFIX = '/api/v1';

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
  });
});

// Mount routes
router.use(`${API_PREFIX}/auth`, authRoutes);
router.use(`${API_PREFIX}/services`, serviceRoutes);
router.use(`${API_PREFIX}/rentals`, rentalRoutes);
router.use(`${API_PREFIX}/event-planning`, eventPlanningRoutes);
router.use(`${API_PREFIX}/events-hosted`, eventsHostedRoutes);
router.use(`${API_PREFIX}/orders`, orderRoutes);
router.use(`${API_PREFIX}/testimonials`, testimonialRoutes);
router.use(`${API_PREFIX}/static`, staticContentRoutes);
router.use(`${API_PREFIX}/sliders`, sliderSlideRoutes);
router.use(`${API_PREFIX}/analytics`, analyticsRoutes);
router.use(`${API_PREFIX}/venues`, venueRoutes);
router.use(`${API_PREFIX}/webhooks`, webhookRoutes);
router.use(`${API_PREFIX}/galleries`, galleryRoutes);

module.exports = router; 