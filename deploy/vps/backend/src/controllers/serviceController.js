const Service = require('../models/Service');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const { uploadToS3, getS3PublicUrl } = require('../utils/s3');

const logger = setupLogger();

const service = new Service();

// Get all services
const getAllServices = async (req, res, next) => {
  try {
    const result = await service.findAll(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Get service by ID
const getService = async (req, res, next) => {
  try {
    const result = await service.findById(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Create new service
const createService = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can create services', 403);
    }

    const result = await service.create(req.body);
    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Update service
const updateService = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can update services', 403);
    }

    const result = await service.update(req.params.id, req.body);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Delete service
const deleteService = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can delete services', 403);
    }

    await service.delete(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Upload service image
const uploadServiceImage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can upload images', 403);
    }

    if (!req.file) {
      throw new AppError('Please upload an image', 400);
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `services/${fileName}`;

    // Upload to S3
    await uploadToS3(filePath, fileBuffer, req.file.mimetype);

    // Get the public URL
    const publicUrl = getS3PublicUrl(filePath);

    // Update the service with the image URL
    const result = await service.update(req.params.id, {
      image_url: publicUrl,
    });

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllServices,
  getService,
  createService,
  updateService,
  deleteService,
  uploadServiceImage,
}; 