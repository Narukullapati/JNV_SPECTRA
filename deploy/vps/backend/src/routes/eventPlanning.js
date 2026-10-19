const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth, isAdmin } = require('../middleware/auth');
const eventPlanningController = require('../controllers/eventPlanningController');
const { validate } = require('../middleware/validate');
const { eventPlanningSchema } = require('../middleware/validate');

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

/**
 * @swagger
 * /api/v1/event-planning:
 *   get:
 *     summary: Get all event planning items
 *     tags: [Event Planning]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of event planning items
 */
router.get('/', eventPlanningController.getAllEventPlanning);

/**
 * @swagger
 * /api/v1/event-planning/{id}:
 *   get:
 *     summary: Get an event planning item by ID
 *     tags: [Event Planning]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event Planning ID
 *     responses:
 *       200:
 *         description: Event planning item details
 *       404:
 *         description: Event planning item not found
 */
router.get('/:id', eventPlanningController.getEventPlanning);

// Protected routes
router.use(auth);

/**
 * @swagger
 * /api/v1/event-planning:
 *   post:
 *     summary: Create a new event planning item
 *     tags: [Event Planning]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               pricing:
 *                 type: number
 *               featured_image:
 *                 type: string
 *               additional_images:
 *                 type: array
 *                 items:
 *                   type: string
 *               bullet_points:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     label:
 *                       type: string
 *                     value:
 *                       type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       201:
 *         description: Event planning item created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/', isAdmin, validate(eventPlanningSchema), eventPlanningController.createEventPlanning);

/**
 * @swagger
 * /api/v1/event-planning/{id}:
 *   put:
 *     summary: Update an event planning item
 *     tags: [Event Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event Planning ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EventPlanning'
 *     responses:
 *       200:
 *         description: Event planning item updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event planning item not found
 */
router.put('/:id', isAdmin, validate(eventPlanningSchema), eventPlanningController.updateEventPlanning);

/**
 * @swagger
 * /api/v1/event-planning/{id}:
 *   delete:
 *     summary: Delete an event planning item
 *     tags: [Event Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event Planning ID
 *     responses:
 *       200:
 *         description: Event planning item deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Event planning item not found
 */
router.delete('/:id', isAdmin, eventPlanningController.deleteEventPlanning);

/**
 * @swagger
 * /api/v1/event-planning/{id}/upload-image:
 *   post:
 *     summary: Upload an image for an event planning item
 *     tags: [Event Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event Planning ID
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
 *         description: No file uploaded
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/upload-image', isAdmin, upload.single('image'), eventPlanningController.uploadEventPlanningImage);

/**
 * @swagger
 * /api/v1/event-planning/{id}/upload-images:
 *   post:
 *     summary: Upload multiple images for an event planning item
 *     tags: [Event Planning]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event Planning ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               tag:
 *                 type: string
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 *       400:
 *         description: No files uploaded
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/upload-images', isAdmin, upload.array('images', 10), eventPlanningController.uploadEventPlanningImages);

module.exports = router; 