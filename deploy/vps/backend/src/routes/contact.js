const express = require('express');
const router = express.Router();
const { contactForm } = require('../controllers/contactController');

// Contact form submission route
router.post('/submit', contactForm);

module.exports = router; 