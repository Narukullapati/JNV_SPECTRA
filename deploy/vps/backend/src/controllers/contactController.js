const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const EmailService = require('../services/emailService');

const logger = setupLogger();

const contactForm = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      throw new AppError('All fields are required', 400);
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Please enter a valid email address', 400);
    }

    // Send email to admin
    await EmailService.sendContactFormEmail({
      name,
      email,
      subject,
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Contact form submitted successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in contact form submission:', error);
      next(new AppError('Error submitting contact form', 500));
    }
  }
};

module.exports = {
  contactForm,
}; 