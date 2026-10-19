const { getUser } = require('../utils/getUser');
const { AppError } = require('../utils/AppError');
const { setupLogger } = require('../utils/logger');
const Venue = require('../models/Venue');
const { uploadToS3, getS3PublicUrl, deleteFromS3 } = require('../utils/s3');

const logger = setupLogger();

// Get all venues
const getAllVenues = async (req, res, next) => {
  try {
    const result = await Venue.findAll(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Get venue by ID
const getVenue = async (req, res, next) => {
  try {
    const result = await Venue.findById(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Create venue
const createVenue = async (req, res, next) => {
  try {
    logger.info('Creating venue with request:', {
      user: req.user,
      body: req.body,
    });

    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can create venues', 403);
    }
    
    const venueData = {
      ...req.body,
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    logger.info('Processed venue data:', venueData);
    
    const result = await Venue.create(venueData);
    
    logger.info('Venue created successfully:', result);

    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    logger.error('Error in createVenue:', error);
    next(error);
  }
};

// Update venue
const updateVenue = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can update venues', 403);
    }

    const result = await Venue.update(req.params.id, req.body);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Delete venue
const deleteVenue = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can delete venues', 403);
    }

    await Venue.delete(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Upload venue image
const uploadVenueImage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can upload venue images', 403);
    }

    if (!req.file) {
      throw new AppError('Please upload an image', 400);
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `venues/${fileName}`;

    // Upload to S3
    await uploadToS3(filePath, fileBuffer, req.file.mimetype);

    // Get the public URL
    const publicUrl = getS3PublicUrl(filePath);

    // Update the venue with the image URL
    const result = await Venue.update(req.params.id, {
      featured_image: publicUrl,
    });

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    logger.error('Error in uploadVenueImage:', error);
    next(error);
  }
};

// Upload multiple venue images
const uploadVenueImages = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can upload venue images', 403);
    }

    if (!req.files || req.files.length === 0) {
      throw new AppError('No files uploaded', 400);
    }

    const venueId = req.params.id;
    if (!venueId) {
      throw new AppError('Venue ID is required', 400);
    }

    // Check if venue exists
    const venueData = await Venue.findById(venueId);
    if (!venueData) {
      throw new AppError('Venue not found', 404);
    }

    // Upload each file
    const uploadPromises = req.files.map(async (file) => {
      const fileBuffer = file.buffer;
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = `venues/${fileName}`;

      // Upload to S3
      await uploadToS3(filePath, fileBuffer, file.mimetype);

      // Get the public URL
      const publicUrl = getS3PublicUrl(filePath);

      return publicUrl;
    });

    const imageUrls = await Promise.all(uploadPromises);

    // Update the venue with the gallery images
    const currentImages = venueData.gallery_images || [];
    const updatedVenue = await Venue.update(venueId, {
      gallery_images: [...currentImages, ...imageUrls],
    });

    res.status(200).json({
      status: 'success',
      data: {
        venue: updatedVenue,
        imageUrls,
      },
    });
  } catch (error) {
    logger.error('Error in uploadVenueImages:', error);
    next(error);
  }
};

// Delete venue image
const deleteVenueImage = async (req, res, next) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return next(new AppError('Image URL is required', 400));
    }

    // Extract the file path from the URL
    const filePath = imageUrl.split('/venues/')[1];
    if (!filePath) {
      return next(new AppError('Invalid image URL', 400));
    }

    // Delete from S3
    await deleteFromS3(filePath);

    res.status(200).json({
      status: 'success',
      message: 'Image deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllVenues,
  getVenue,
  createVenue,
  updateVenue,
  deleteVenue,
  uploadVenueImage,
  uploadVenueImages,
  deleteVenueImage,
}; 