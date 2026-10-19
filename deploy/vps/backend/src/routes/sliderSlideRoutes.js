const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getAllSliderSlides,
  getSlidesBySliderName,
  getSliderSlide,
  createSliderSlide,
  updateSliderSlide,
  deleteSliderSlide,
  reorderSlides,
  uploadSlideImage,
} = require('../controllers/sliderSlideController');
const { auth, isAdmin } = require('../middleware/auth');
const { validateSliderSlide } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/rateLimiter');

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

// Public routes - Order matters! More specific routes should come first
router.get('/slide/:id', apiLimiter, getSliderSlide);
router.get('/name/:slider_name', apiLimiter, getSlidesBySliderName);
router.get('/', apiLimiter, getAllSliderSlides);

// Protected routes (admin only)
router.post('/',
  apiLimiter,
  auth,
  isAdmin,
  validateSliderSlide,
  createSliderSlide,
);

router.put('/:id',
  apiLimiter,
  auth,
  isAdmin,
  validateSliderSlide,
  updateSliderSlide,
);

router.delete('/:id',
  apiLimiter,
  auth,
  isAdmin,
  deleteSliderSlide,
);

router.post('/:id/upload-image',
  apiLimiter,
  auth,
  isAdmin,
  upload.single('image'),
  uploadSlideImage,
);

router.post('/reorder',
  apiLimiter,
  auth,
  isAdmin,
  reorderSlides,
);

module.exports = router; 