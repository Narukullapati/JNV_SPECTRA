const { getUser } = require('../utils/getUser');
const { AppError } = require('../utils/AppError');
const { setupLogger } = require('../utils/logger');
const { uploadToS3, getS3PublicUrl, deleteFromS3 } = require('../utils/s3');
const Rental = require('../models/Rental');

const logger = setupLogger();

const rental = new Rental();

// Get all rentals
const getAllRentals = async (req, res, next) => {
  try {
    const result = await rental.findAll(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Get rental by ID
const getRental = async (req, res, next) => {
  try {
    const result = await rental.findById(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Create rental
const createRental = async (req, res, next) => {
  try {
    logger.info('Creating rental with request:', {
      user: req.user,
      body: req.body,
    });

    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can create rentals', 403);
    }
    
    const rentalData = {
      ...req.body,
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    logger.info('Processed rental data:', rentalData);
    
    const result = await rental.create(rentalData);
    
    logger.info('Rental created successfully:', result);

    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    logger.error('Error in createRental:', error);
    next(error);
  }
};

// Update rental
const updateRental = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can update rentals', 403);
    }

    const result = await rental.update(req.params.id, req.body);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Delete rental
const deleteRental = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can delete rentals', 403);
    }

    await rental.delete(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Upload rental image
const uploadRentalImage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can upload rental images', 403);
    }

    if (!req.file) {
      throw new AppError('Please upload an image', 400);
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `rentals/${fileName}`;

    // Upload to S3
    await uploadToS3(filePath, fileBuffer, req.file.mimetype);

    // Get the public URL
    const publicUrl = getS3PublicUrl(filePath);

    // Update the rental with the image URL
    const result = await rental.update(req.params.id, {
      featured_image: publicUrl,
    });

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    logger.error('Error in uploadRentalImage:', error);
    next(error);
  }
};

// Upload multiple rental images
const uploadRentalImages = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      return next(new AppError('Only admins can upload rental images', 403));
    }

    if (!req.files || req.files.length === 0) {
      return next(new AppError('No files uploaded', 400));
    }

    const rentalId = req.params.id;
    if (!rentalId) {
      return next(new AppError('Rental ID is required', 400));
    }

    // Check if rental exists
    const rental = await Rental.findById(rentalId);
    if (!rental) {
      return next(new AppError('Rental not found', 404));
    }

    // Upload each file
    const uploadPromises = req.files.map(async (file) => {
      const fileBuffer = file.buffer;
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = `rentals/${fileName}`;

      // Upload to S3
      await uploadToS3(filePath, fileBuffer, file.mimetype);

      // Get the public URL
      const publicUrl = getS3PublicUrl(filePath);

      return publicUrl;
    });

    const imageUrls = await Promise.all(uploadPromises);

    // Update the rental with the gallery images
    const currentImages = rental.gallery_images || [];
    const updatedRental = await rental.update(rentalId, {
      gallery_images: [...currentImages, ...imageUrls],
    });

    res.status(200).json({
      status: 'success',
      data: {
        rental: updatedRental,
        imageUrls,
      },
    });
  } catch (error) {
    logger.error('Error in uploadRentalImages:', error);
    next(error);
  }
};

// Delete rental image
const deleteRentalImage = async (req, res, next) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return next(new AppError('Image URL is required', 400));
    }

    // Extract the file path from the URL
    const filePath = imageUrl.split('/rentals/')[1];
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
  getAllRentals,
  getRental,
  createRental,
  updateRental,
  deleteRental,
  uploadRentalImage,
  uploadRentalImages,
  deleteRentalImage,
}; 
