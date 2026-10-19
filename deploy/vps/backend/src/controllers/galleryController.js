const Gallery = require('../models/gallery.model');
const { AppError } = require('../utils/AppError');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

class GalleryController {
  async createGallery(req, res, next) {
    try {
      const { title, tagline, images } = req.body;

      if (!title || !tagline || !images) {
        throw new AppError('Missing required fields', 400);
      }

      const gallery = await Gallery.createGallery({
        title,
        tagline,
        images,
      });

      res.status(201).json({
        status: 'success',
        data: gallery,
      });
    } catch (error) {
      logger.error('Error creating gallery:', error);
      next(error);
    }
  }

  async getGallery(req, res, next) {
    try {
      const { id } = req.params;
      const gallery = await Gallery.getGallery(id);

      if (!gallery) {
        throw new AppError('Gallery not found', 404);
      }

      res.status(200).json({
        status: 'success',
        data: gallery,
      });
    } catch (error) {
      logger.error('Error getting gallery:', error);
      next(error);
    }
  }

  async getAllGalleries(req, res, next) {
    try {
      const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
      
      const galleries = await Gallery.getAllGalleries({
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
      });

      res.status(200).json({
        status: 'success',
        data: galleries,
      });
    } catch (error) {
      logger.error('Error getting all galleries:', error);
      next(error);
    }
  }

  async updateGallery(req, res, next) {
    try {
      const { id } = req.params;
      const { title, tagline, images } = req.body;

      const gallery = await Gallery.updateGallery(id, {
        title,
        tagline,
        images,
      });

      if (!gallery) {
        throw new AppError('Gallery not found', 404);
      }

      res.status(200).json({
        status: 'success',
        data: gallery,
      });
    } catch (error) {
      logger.error('Error updating gallery:', error);
      next(error);
    }
  }

  async deleteGallery(req, res, next) {
    try {
      const { id } = req.params;
      const gallery = await Gallery.delete(id);

      if (!gallery) {
        throw new AppError('Gallery not found', 404);
      }

      res.status(204).json({
        status: 'success',
        data: null,
      });
    } catch (error) {
      logger.error('Error deleting gallery:', error);
      next(error);
    }
  }
}

module.exports = new GalleryController(); 