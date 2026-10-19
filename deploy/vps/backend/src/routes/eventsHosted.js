const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, isAdmin } = require('../middleware/auth');
const {
  getAllEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  uploadEventImage,
  uploadGalleryImage,
} = require('../controllers/eventsHostedController');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// Public routes
router.get('/', getAllEvents);
router.get('/:id', getEvent);

// Protected routes (admin only)
router.post('/', protect, isAdmin, createEvent);
router.put('/:id', protect, isAdmin, updateEvent);
router.delete('/:id', protect, isAdmin, deleteEvent);
router.post('/:id/upload-image', protect, isAdmin, upload.single('image'), uploadEventImage);
router.post('/:id/upload-gallery', protect, isAdmin, upload.single('image'), uploadGalleryImage);

module.exports = router; 