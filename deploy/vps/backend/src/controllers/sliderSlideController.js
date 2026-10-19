const SliderSlide = require('../models/sliderSlide');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const { uploadToS3, getS3PublicUrl } = require('../utils/s3');

const logger = setupLogger();

const sliderSlide = new SliderSlide();

// Get all slider slides
const getAllSliderSlides = async (req, res, next) => {
  try {
    const result = await sliderSlide.findAll();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Get slides by slider name
const getSlidesBySliderName = async (req, res, next) => {
  try {
    logger.info('getSlidesBySliderName called with params:', {
      params: req.params,
      query: req.query,
    });

    const sliderName = req.params.slider_name;
    if (!sliderName) {
      throw new AppError('Slider name is required', 400);
    }

    logger.info('Fetching slides for slider name:', sliderName);
    const result = await sliderSlide.findBySliderName(sliderName);
    logger.info('Found slides:', { 
      count: result?.length,
      result: result, 
    });

    if (!result || result.length === 0) {
      logger.info('No slides found for slider name:', sliderName);
      return res.status(200).json([]);
    }

    // Filter by status if provided
    if (req.query.status) {
      const filteredResult = result.filter((slide) => slide.status === req.query.status);
      logger.info('Filtered slides by status:', { 
        status: req.query.status,
        count: filteredResult.length,
        result: filteredResult,
      });
      return res.status(200).json(filteredResult);
    }

    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in getSlidesBySliderName:', {
      error: error.message,
      stack: error.stack,
      params: req.params,
      query: req.query,
    });
    next(error);
  }
};

// Get slide by ID
const getSliderSlide = async (req, res, next) => {
  try {
    const result = await sliderSlide.findById(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Create new slide
const createSliderSlide = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can create slider slides', 403);
    }

    const result = await sliderSlide.create(req.body);
    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Update slide
const updateSliderSlide = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can update slider slides', 403);
    }

    const result = await sliderSlide.update(req.params.id, req.body);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Delete slide
const deleteSliderSlide = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can delete slider slides', 403);
    }

    await sliderSlide.delete(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    logger.error('Error in deleteSliderSlide:', {
      error: error.message,
      stack: error.stack,
      slideId: req.params.id,
    });
    next(error);
  }
};

// Reorder slides
const reorderSlides = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can reorder slides', 403);
    }

    const { sliderName, newOrder } = req.body;
    if (!sliderName || !newOrder || !Array.isArray(newOrder)) {
      throw new AppError('Invalid reorder data', 400);
    }

    const result = await sliderSlide.reorderSlides(sliderName, newOrder);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Upload slide image
const uploadSlideImage = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can upload images', 403);
    }

    if (!req.file) {
      throw new AppError('Please upload an image', 400);
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `slider-slides/${fileName}`;

    // Upload to S3
    await uploadToS3(filePath, fileBuffer, req.file.mimetype);

    // Get the public URL
    const publicUrl = getS3PublicUrl(filePath);

    // Update the slide with the image URL
    const result = await sliderSlide.update(req.params.id, {
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
  getAllSliderSlides,
  getSlidesBySliderName,
  getSliderSlide,
  createSliderSlide,
  updateSliderSlide,
  deleteSliderSlide,
  reorderSlides,
  uploadSlideImage,
}; 