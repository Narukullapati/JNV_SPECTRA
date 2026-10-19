const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getAllSliderSlides,
  getSliderSlide,
  createSliderSlide,
  updateSliderSlide,
  deleteSliderSlide,
  reorderSlides,
  uploadSlideImage,
} = require('../controllers/sliderSlideController');
const { protect, isAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { sliderSlideSchema } = require('../middleware/validate');

// Configure multer for image upload
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .png, .jpg and .jpeg format allowed!'));
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Public routes
router.get('/', getAllSliderSlides);
router.get('/:id', getSliderSlide);

// Protected routes
router.post('/', protect, isAdmin, validate(sliderSlideSchema), createSliderSlide);
router.put('/:id', protect, isAdmin, validate(sliderSlideSchema), updateSliderSlide);
router.delete('/:id', protect, isAdmin, deleteSliderSlide);
router.post('/:id/upload-image', protect, isAdmin, upload.single('image'), uploadSlideImage);
router.post('/reorder', protect, isAdmin, reorderSlides);

module.exports = router; 