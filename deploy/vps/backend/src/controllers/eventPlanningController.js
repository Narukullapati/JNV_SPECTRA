const eventPlanning = require('../models/EventPlanning');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const { uploadToS3, getS3PublicUrl } = require('../utils/s3');

const logger = setupLogger();

// Get all event planning items
const getAllEventPlanning = async (req, res, next) => {
  try {
    const result = await eventPlanning.findAll(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Get event planning item by ID
const getEventPlanning = async (req, res, next) => {
  try {
    const result = await eventPlanning.findById(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Create new event planning item
const createEventPlanning = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can create event planning items', 403);
    }

    const result = await eventPlanning.create(req.body);
    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Update event planning item
const updateEventPlanning = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can update event planning items', 403);
    }

    const result = await eventPlanning.update(req.params.id, req.body);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Delete event planning item
const deleteEventPlanning = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can delete event planning items', 403);
    }

    await eventPlanning.delete(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Upload event planning image
const uploadEventPlanningImage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can upload images', 403);
    }

    if (!req.file) {
      throw new AppError('Please upload an image', 400);
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `event-planning/${fileName}`;

    // Upload to S3
    await uploadToS3(filePath, fileBuffer, req.file.mimetype);

    // Get the public URL
    const publicUrl = getS3PublicUrl(filePath);

    // Update the event planning item with the image URL
    const result = await eventPlanning.update(req.params.id, {
      featured_image: publicUrl,
    });

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Upload multiple images for event planning
const uploadEventPlanningImages = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can upload images', 403);
    }

    if (!req.params.id) {
      throw new AppError('Event planning ID is required', 400);
    }

    if (!req.files || req.files.length === 0) {
      throw new AppError('Please upload at least one image', 400);
    }

    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    for (const file of req.files) {
      if (!allowedTypes.includes(file.mimetype)) {
        throw new AppError('Only JPEG, PNG, and GIF images are allowed', 400);
      }
    }

    // Get current event planning item
    const planningItem = await eventPlanning.findById(req.params.id);

    // Process and upload each file
    const uploadPromises = req.files.map(async (file) => {
      const fileBuffer = file.buffer;
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = `event-planning/gallery/${fileName}`;

      // Upload to S3
      await uploadToS3(filePath, fileBuffer, file.mimetype);

      // Get the public URL
      const publicUrl = getS3PublicUrl(filePath);

      return {
        url: publicUrl,
        tag: req.body.tag || 'gallery',
      };
    });

    const newImages = await Promise.all(uploadPromises);

    // Update additional_images array
    const additionalImages = planningItem.additional_images || [];
    additionalImages.push(...newImages);

    // Update the event planning item with the new images
    const updatedItem = await eventPlanning.update(req.params.id, {
      additional_images: additionalImages,
    });

    res.status(200).json({
      status: 'success',
      data: updatedItem,
    });
  } catch (error) {
    logger.error('Error in uploadEventPlanningImages:', error);
    next(error);
  }
};

module.exports = {
  getAllEventPlanning,
  getEventPlanning,
  createEventPlanning,
  updateEventPlanning,
  deleteEventPlanning,
  uploadEventPlanningImage,
  uploadEventPlanningImages,
}; 