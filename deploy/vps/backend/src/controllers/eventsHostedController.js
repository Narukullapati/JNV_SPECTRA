const EventsHosted = require('../models/EventsHosted');
const { uploadToS3, getS3PublicUrl } = require('../utils/s3');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

const eventsHosted = new EventsHosted();
// Get all events
const getAllEvents = async (req, res, next) => {
  try {
    const events = await eventsHosted.findAll(req.query);
    res.status(200).json({
      status: 'success',
      data: events,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in getAllEvents:', error);
      next(new AppError('Error retrieving events', 500));
    }
  }
};

// Get event by ID
const getEvent = async (req, res, next) => {
  try {
    if (!req.params.id) {
      throw new AppError('Event ID is required', 400);
    }

    const event = await eventsHosted.findById(req.params.id);
    res.status(200).json({
      status: 'success',
      data: event,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in getEvent:', error);
      next(new AppError('Error retrieving event', 500));
    }
  }
};

// Create new event
const createEvent = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can create events', 403);
    }

    // Validate required fields
    const requiredFields = ['event_title', 'event_date', 'event_type', 'short_description', 'detailed_description', 'location'];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
    
    if (missingFields.length > 0) {
      throw new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400);
    }

    // Validate rating if provided
    if (req.body.rating !== undefined) {
      const rating = parseFloat(req.body.rating);
      if (isNaN(rating) || rating < 0 || rating > 5) {
        throw new AppError('Rating must be a number between 0 and 5', 400);
      }
      req.body.rating = rating;
    }

    const eventData = {
      event_title: req.body.event_title,
      event_date: req.body.event_date,
      event_type: req.body.event_type,
      short_description: req.body.short_description,
      detailed_description: req.body.detailed_description,
      location: req.body.location,
      featured_image: req.body.featured_image,
      gallery_images: req.body.gallery_images,
      status: req.body.status || 'draft',
      feedback: req.body.feedback,
      rating: req.body.rating,
    };

    const event = await eventsHosted.create(eventData);
    res.status(201).json({
      status: 'success',
      data: event,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in createEvent:', error);
      next(new AppError('Error creating event', 500));
    }
  }
};

// Update event
const updateEvent = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can update events', 403);
    }

    if (!req.params.id) {
      throw new AppError('Event ID is required', 400);
    }

    // Validate rating if provided
    if (req.body.rating !== undefined) {
      const rating = parseFloat(req.body.rating);
      if (isNaN(rating) || rating < 0 || rating > 5) {
        throw new AppError('Rating must be a number between 0 and 5', 400);
      }
      req.body.rating = rating;
    }

    const eventData = {
      event_title: req.body.event_title,
      event_date: req.body.event_date,
      event_type: req.body.event_type,
      short_description: req.body.short_description,
      detailed_description: req.body.detailed_description,
      location: req.body.location,
      featured_image: req.body.featured_image,
      gallery_images: req.body.gallery_images,
      status: req.body.status,
      feedback: req.body.feedback,
      rating: req.body.rating,
    };

    const event = await eventsHosted.update(req.params.id, eventData);
    res.status(200).json({
      status: 'success',
      data: event,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in updateEvent:', error);
      next(new AppError('Error updating event', 500));
    }
  }
};

// Delete event
const deleteEvent = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can delete events', 403);
    }

    if (!req.params.id) {
      throw new AppError('Event ID is required', 400);
    }

    await eventsHosted.delete(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in deleteEvent:', error);
      next(new AppError('Error deleting event', 500));
    }
  }
};

// Upload event image
const uploadEventImage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can upload images', 403);
    }

    if (!req.params.id) {
      throw new AppError('Event ID is required', 400);
    }

    if (!req.file) {
      throw new AppError('Please upload an image', 400);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      throw new AppError('Only JPEG, PNG, and GIF images are allowed', 400);
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `events-hosted/${fileName}`;

    // Upload to S3
    await uploadToS3(filePath, fileBuffer, req.file.mimetype);

    // Get the public URL
    const publicUrl = getS3PublicUrl(filePath);

    // Update the event with the image URL
    const event = await eventsHosted.update(req.params.id, {
      featured_image: publicUrl,
    });

    res.status(200).json({
      status: 'success',
      data: event,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in uploadEventImage:', error);
      next(new AppError('Error uploading event image', 500));
    }
  }
};

// Upload gallery image
const uploadGalleryImage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can upload gallery images', 403);
    }

    if (!req.params.id) {
      throw new AppError('Event ID is required', 400);
    }

    if (!req.file) {
      throw new AppError('Please upload an image', 400);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      throw new AppError('Only JPEG, PNG, and GIF images are allowed', 400);
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `events-hosted/gallery/${fileName}`;

    // Upload to S3
    await uploadToS3(filePath, fileBuffer, req.file.mimetype);

    // Get the public URL
    const publicUrl = getS3PublicUrl(filePath);

    // Get current event
    const event = await eventsHosted.findById(req.params.id);
    const galleryImages = event.gallery_images || [];

    // Add new image to gallery
    galleryImages.push(publicUrl);

    // Update the event with the new gallery image
    const updatedEvent = await eventsHosted.update(req.params.id, {
      gallery_images: galleryImages,
    });

    res.status(200).json({
      status: 'success',
      data: updatedEvent,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in uploadGalleryImage:', error);
      next(new AppError('Error uploading gallery image', 500));
    }
  }
};

module.exports = {
  getAllEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadEventImage,
  uploadGalleryImage,
}; 