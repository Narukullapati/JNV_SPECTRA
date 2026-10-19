require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
});
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');

// Import database configuration
require('./config/database');

const { errorHandler } = require('./middleware/errorHandler');
const { setupLogger } = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const venueRoutes = require('./routes/venueRoutes');
const serviceRoutes = require('./routes/services');
const rentalRoutes = require('./routes/rentals');
const eventPlanningRoutes = require('./routes/eventPlanning');
const imageRoutes = require('./routes/imageRoutes');
const sliderRoutes = require('./routes/sliderRoutes');
const sliderSlideRoutes = require('./routes/sliderSlideRoutes');
const analyticsRoutes = require('./routes/analytics');
const staticContentRoutes = require('./routes/staticContentRoutes');
const testimonialRoutes = require('./routes/testimonialRoutes');
const orderRoutes = require('./routes/orders');
const eventsHostedRoutes = require('./routes/eventsHosted');
const webhookRoutes = require('./routes/webhooks');
const galleryRoutes = require('./routes/galleryRoutes');
const contactRoutes = require('./routes/contact');

const app = express();
const logger = setupLogger();

//app.set('trust proxy', true);

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Event Management API',
      version: '1.0.0',
      description: 'API documentation for Event Management System',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT}`,
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS),
});
app.use(limiter);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Debug middleware for webhook requests
app.use((req, res, next) => {
  if (req.path.includes('webhooks')) {
    logger.info('Webhook request received:', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      headers: req.headers,
    });
  }
  next();
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/venues', venueRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/rentals', rentalRoutes);
app.use('/api/v1/event-planning', eventPlanningRoutes);
app.use('/api/v1/images', imageRoutes);
app.use('/api/v1/sliders', sliderRoutes);
app.use('/api/v1/slider-slides', sliderSlideRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/static-content', staticContentRoutes);
app.use('/api/v1/testimonials', testimonialRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/events-hosted', eventsHostedRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/galleries', galleryRoutes);
app.use('/api/v1/contact', contactRoutes);
// Root API endpoint
app.get('/', (req, res) => {
  logger.info('Root endpoint hit');
  res.status(200).json({
    status: 'success',
    message: 'Welcome to JNV Events Management API',
    version: '1.0.0',
    developedBy: 'CodeCapo',
    documentation: '/api-docs',
  });
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
}); 
