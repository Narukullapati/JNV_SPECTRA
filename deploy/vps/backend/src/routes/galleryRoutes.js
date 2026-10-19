const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const { auth, isAdmin } = require('../middleware/auth');
const { validateGallery } = require('../middleware/validation');

// Public routes (no auth required)
router.get('/', galleryController.getAllGalleries);
router.get('/:id', galleryController.getGallery);

// Protected routes (require auth)
router.use(auth);

// Create gallery (admin only)
router.post(
  '/',
  isAdmin,
  validateGallery,
  galleryController.createGallery,
);

// Update gallery (admin only)
router.put(
  '/:id',
  isAdmin,
  validateGallery,
  galleryController.updateGallery,
);

// Delete gallery (admin only)
router.delete(
  '/:id',
  isAdmin,
  galleryController.deleteGallery,
);

module.exports = router; 