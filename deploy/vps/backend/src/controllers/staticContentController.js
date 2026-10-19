const StaticContent = require('../models/staticContent');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const { uploadToS3, getS3PublicUrl } = require('../utils/s3');

const logger = setupLogger();

// Get all static content
const getAllStaticContent = async (req, res, next) => {
  try {
    const result = await StaticContent.findAll();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Get static content by ID
const getStaticContent = async (req, res, next) => {
  try {
    const result = await StaticContent.findById(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Get static content by section
const getStaticContentBySection = async (req, res, next) => {
  try {
    const result = await StaticContent.findByType(req.params.section);
    res.status(200).json({
      status: 'success',
      data: result || null,
    });
  } catch (error) {
    next(error);
  }
};

// Create new static content
const createStaticContent = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can create static content', 403);
    }

    const result = await StaticContent.create(req.body);
    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Update static content
const updateStaticContent = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can update static content', 403);
    }

    const result = await StaticContent.update(req.params.id, req.body);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Update static content by section
const updateStaticContentBySection = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can update static content', 403);
    }

    const result = await StaticContent.updateByType(req.params.section, req.body);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Delete static content
const deleteStaticContent = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can delete static content', 403);
    }

    await StaticContent.delete(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Upload static content image
const uploadStaticContentImage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can upload images', 403);
    }

    if (!req.file) {
      throw new AppError('Please upload an image', 400);
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `static-content/${fileName}`;

    // Upload to S3
    await uploadToS3(filePath, fileBuffer, req.file.mimetype);

    // Get the public URL
    const publicUrl = getS3PublicUrl(filePath);

    // Update the static content with the image URL
    const result = await StaticContent.update(req.params.id, {
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
  getAllStaticContent,
  getStaticContent,
  getStaticContentBySection,
  createStaticContent,
  updateStaticContent,
  updateStaticContentBySection,
  deleteStaticContent,
  uploadStaticContentImage,
}; 