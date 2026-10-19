const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getStaticContentBySection,
  updateStaticContentBySection,
  createStaticContent,
  getAllStaticContent,
  uploadStaticContentImage,
  deleteStaticContent,
} = require('../controllers/staticContentController');
const { auth, isAdmin } = require('../middleware/auth');
const { validateStaticContent } = require('../middleware/validation');
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

// Public routes
router.get('/', apiLimiter, getAllStaticContent);
router.get('/:section', apiLimiter, getStaticContentBySection);

// Protected routes (admin only)
router.post('/',
  apiLimiter,
  auth,
  isAdmin,
  validateStaticContent,
  createStaticContent,
);

router.put('/:section',
  apiLimiter,
  auth,
  isAdmin,
  validateStaticContent,
  updateStaticContentBySection,
);

router.delete('/:section',
  apiLimiter,
  auth,
  isAdmin,
  deleteStaticContent,
);

router.post('/:section/upload-image',
  apiLimiter,
  auth,
  isAdmin,
  upload.single('image'),
  uploadStaticContentImage,
);

router.delete('/:section/image',
  apiLimiter,
  auth,
  isAdmin,
  deleteStaticContent,
);

module.exports = router; 