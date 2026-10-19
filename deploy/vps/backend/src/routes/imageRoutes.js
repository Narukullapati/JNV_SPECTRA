const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth, isAdmin } = require('../middleware/auth');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const { uploadToS3, getS3PublicUrl } = require('../utils/s3');

const logger = setupLogger();

// Configure multer for image upload
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .png, .jpg, .jpeg, .gif, and .webp formats allowed!'));
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Add a test route to verify the router is working
router.get('/test', (req, res) => {
  logger.info('Test route hit');
  res.json({ message: 'Image routes are working' });
});

/**
 * @swagger
 * /api/v1/images/upload:
 *   post:
 *     summary: Upload a single image
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/upload', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('Please upload an image', 400);
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `images/${fileName}`;

    // Upload to S3
    await uploadToS3(filePath, fileBuffer, req.file.mimetype);

    // Get the public URL
    const publicUrl = getS3PublicUrl(filePath);

    res.status(200).json({
      status: 'success',
      data: {
        url: publicUrl,
      },
    });
  } catch (error) {
    logger.error('Error in image upload:', error);
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/images/upload-multiple:
 *   post:
 *     summary: Upload multiple images
 *     tags: [Images]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/upload-multiple', upload.array('files'), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new AppError('Please upload at least one image', 400);
    }

    // Upload each file
    const uploadPromises = req.files.map(async (file) => {
      const fileBuffer = file.buffer;
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = `images/${fileName}`;

      // Upload to S3
      await uploadToS3(filePath, fileBuffer, file.mimetype);

      // Get the public URL
      const publicUrl = getS3PublicUrl(filePath);

      return publicUrl;
    });

    const imageUrls = await Promise.all(uploadPromises);

    res.status(200).json({
      status: 'success',
      data: {
        urls: imageUrls,
      },
    });
  } catch (error) {
    logger.error('Error in multiple image upload:', error);
    next(error);
  }
});

module.exports = router; 