const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const { setupLogger } = require('./utils/logger');
const { AppError } = require('./utils/AppError');
const { connectDB } = require('./config/database');
const SquareService = require('./services/squareService');
const webhookRoutes = require('./routes/webhooks');

const logger = setupLogger();

const app = express();

// Load Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

// Initialize Square service
let squareService;
try {
  squareService = SquareService();
  logger.info('Square service initialized successfully');
} catch (error) {
  logger.error('Failed to initialize Square service:', error);
  // Continue without Square service - the app will still work but payment features will be disabled
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Public routes (no auth required)
app.use('/api/v1/webhooks', webhookRoutes);

// Routes
const authRoutes = require('./routes/auth');
const venueRoutes = require('./routes/venueRoutes');
const serviceRoutes = require('./routes/services');
const rentalRoutes = require('./routes/rentals');
const eventPlanningRoutes = require('./routes/eventPlanningRoutes');
const imageRoutes = require('./routes/imageRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const contactRoutes = require('./routes/contact');

// Use mock models in test environment
if (process.env.NODE_ENV === 'test') {
  const User = require('./tests/mocks/User');
  const Rental = require('./tests/mocks/Rental');
  app.set('User', User);
  app.set('Rental', Rental);
}

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/venues', venueRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/rentals', rentalRoutes);
app.use('/api/v1/event-planning', eventPlanningRoutes);
app.use('/api/v1/images', imageRoutes);
app.use('/api/v1/galleries', galleryRoutes);
app.use('/api/v1/contact', contactRoutes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Handle 404 errors
app.all('*', (req, res, next) => {
  logger.warn(`404 - Route not found: ${req.originalUrl}`);
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Error handling middleware
app.use(errorHandler);

// Database connection
connectDB().catch((error) => {
  logger.error('Database connection error:', error);
  process.exit(1);
});

module.exports = app; 
