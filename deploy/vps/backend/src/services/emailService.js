const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const emailClient = require('../config/email');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const { DateTime } = require('luxon');

const logger = setupLogger();

const parseLocalDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
    const dateOnly = datePart.match(/^\d{4}-\d{2}-\d{2}$/);
    if (dateOnly) {
      const [year, month, day] = dateOnly[0].split('-').map(Number);
      return new Date(year, month - 1, day);
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const format12HourTime = (value) => {
  if (!value) return 'N/A';

  const raw = String(value).trim();
  if (!raw) return 'N/A';

  const explicitMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (explicitMatch) {
    let hour = Number(explicitMatch[1]);
    const minute = explicitMatch[2];
    let meridiem = (explicitMatch[3] || '').toUpperCase();

    if (meridiem) {
      if (meridiem === 'AM' && hour === 12) hour = 0;
      if (meridiem === 'PM' && hour < 12) hour += 12;
    } else if (hour >= 12) {
      meridiem = 'PM';
      if (hour > 12) hour -= 12;
    } else {
      meridiem = 'AM';
      if (hour === 0) hour = 12;
    }

    return `${hour}:${minute} ${meridiem}`;
  }

  const isoMatch = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (isoMatch) {
    let hour = Number(isoMatch[1]);
    const minute = isoMatch[2];
    let meridiem = hour >= 12 ? 'PM' : 'AM';
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${meridiem}`;
  }

  return raw;
};

class EmailService {
  static uniqueRecipients(...groups) {
    const recipients = groups
      .flat()
      .flatMap((value) => String(value || '').split(','))
      .map((value) => value.trim())
      .filter(Boolean);

    return [...new Set(recipients.map((value) => value.toLowerCase()))];
  }

  static async sendEmail(mailOptions, context, options) {
    return emailClient.sendEmail(mailOptions, context, options);
  }

  static async sendCustomerEmailWithAdminCopy(mailOptions, context) {
    const customerRecipients = EmailService.uniqueRecipients(mailOptions.to);
    const adminRecipients = EmailService.uniqueRecipients(mailOptions.cc, mailOptions.bcc)
      .filter((email) => !customerRecipients.includes(email));

    if (!customerRecipients.length) {
      throw new AppError(`Customer recipient is required for ${context}`, 400);
    }

    const customerResult = await EmailService.sendEmail({
      ...mailOptions,
      to: customerRecipients,
      cc: undefined,
      bcc: undefined,
    }, `${context} (customer)`, { preferredTransport: 'smtp' });

    if (adminRecipients.length) {
      try {
        await EmailService.sendEmail({
          ...mailOptions,
          to: adminRecipients,
          cc: undefined,
          bcc: undefined,
          subject: `[Admin Copy] ${mailOptions.subject}`,
        }, `${context} (admin copy)`);
      } catch (error) {
        logger.warn(`Admin copy failed for ${context}:`, {
          error: error.message,
          to: adminRecipients,
          subject: mailOptions.subject,
        });
      }
    }

    return customerResult;
  }

  static async sendQuotationEmail(order, pdfUrl, checkoutUrl) {
    try {
      // Read the email template
      const templatePath = path.join(__dirname, '../templates/email/quotation.html');
      
      // Check if template file exists
      if (!fs.existsSync(templatePath)) {
        logger.error(`Email template not found at path: ${templatePath}`);
        throw new AppError('Email template not found', 500);
      }
      
      const template = fs.readFileSync(templatePath, 'utf8');
      const compiledTemplate = handlebars.compile(template);

      // Log email data for debugging
      logger.info(`Preparing quotation email for order: ${order.id}, customer: ${order.customer_name}`);
      
      // Prepare email data
      const quotationData = {
        customerName: order.customer_name,
        email: order.email,
        serviceType: order.order_details.items[0]?.name || 'Event Services',
        eventDate: order.event_date ? parseLocalDate(order.event_date)?.toLocaleDateString() || '' : '',
        eventTime: format12HourTime(order.event_time),
        amount: order.deposit_amount,
        paymentType: 'Deposit',
        quotationUrl: pdfUrl,
        paymentLink: order.payment_option === 'online' ? checkoutUrl : null,
        companyName: process.env.COMPANY_NAME || 'Our Company',
        companyEmail: process.env.COMPANY_EMAIL || 'info@example.com',
        companyPhone: process.env.COMPANY_PHONE || 'N/A',
        items: order.order_details.items,
        total: order.total_amount,
        zelleEmail: 'jnvcommercials@gmail.com',
      };

      // Compile the template with data
      const html = compiledTemplate(quotationData);
      const attachments = pdfUrl
        ? [
          {
            filename: 'invoice.pdf',
            path: pdfUrl,
          },
        ]
        : [];

      if (!pdfUrl) {
        logger.warn(`Invoice PDF URL missing for order ${order.id}. Sending email without attachment.`);
      }

      // Send email using Resend
      await EmailService.sendCustomerEmailWithAdminCopy({
        from: process.env.EMAIL_FROM,
        to: order.email,
        bcc: process.env.ADMIN_EMAIL,
        subject: `Invoice for ${order.order_details.items[0]?.name || 'Event Services'} - ${order.customer_name}`,
        html: html,
        attachments,
      }, 'invoice email');

      logger.info(`Invoice email sent to ${order.email} and ${process.env.ADMIN_EMAIL}`);
    } catch (error) {
      logger.error('Error sending quotation email:', error);
      throw new AppError('Error sending quotation email', 500);
    }
  }

  static async sendInvoiceEmail(order, pdfUrl) {
    try {
      const templatePath = path.join(__dirname, '../templates/email/invoice.html');
      const template = fs.readFileSync(templatePath, 'utf8');
      const compiledTemplate = handlebars.compile(template);

       const invoiceData = {
         customerName: order.customer_name,
         email: order.email,
         serviceType: order.order_details.items[0]?.name || 'Event Services',
         eventDate: parseLocalDate(order.event_date)?.toLocaleDateString() || '',
         eventTime: format12HourTime(order.event_time),
         invoiceNumber: `INV-${order.id}`,
         paymentDate: new Date().toLocaleDateString(),
         paymentMethod: order.payment_option === 'online' ? 'Online Payment' : 'Offline Payment',
         total: Number(order.total_amount).toFixed(2),
         companyName: process.env.COMPANY_NAME || 'JNV Events',
         companyEmail: process.env.COMPANY_EMAIL || 'info@jnvevents.com',
         companyPhone: process.env.COMPANY_PHONE || '+1 352 773 2872',
         zelleEmail: 'jnvcommercials@gmail.com',
       };

      const html = compiledTemplate(invoiceData);
      const attachments = pdfUrl
        ? [
          {
            filename: 'receipt.pdf',
            path: pdfUrl,
          },
        ]
        : [];

      if (!pdfUrl) {
        logger.warn(`Receipt PDF URL missing for order ${order.id}. Sending email without attachment.`);
      }

      await EmailService.sendCustomerEmailWithAdminCopy({
        from: process.env.EMAIL_FROM,
        to: order.email,
        bcc: process.env.ADMIN_EMAIL,
        subject: `Receipt for ${order.customer_name} : ${parseLocalDate(order.event_date)?.toLocaleDateString() || ''}`,
        html: html,
        attachments,
      }, 'receipt email');

      logger.info(`Receipt email sent to ${order.email} and ${process.env.ADMIN_EMAIL}`);
    } catch (error) {
      logger.error('Error sending invoice email:', error);
      throw new AppError('Error sending invoice email', 500);
    }
  }

  static async sendReviewRequestEmail(order) {
    try {
      const templatePath = path.join(__dirname, '../templates/email/review-request.html');
      const template = fs.readFileSync(templatePath, 'utf8');
      const compiledTemplate = handlebars.compile(template);

      // Generate a unique review link
      const reviewLink = `${process.env.FRONTEND_URL}/review/${order.id}`;

      const reviewData = {
        customerName: order.customer_name,
        email: order.email,
        serviceType: order.order_details.items[0]?.name || 'Event Services',
        eventDate: order.event_date,
        reviewLink: reviewLink,
      };

      const html = compiledTemplate(reviewData);

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: order.email,
        bcc: process.env.ADMIN_EMAIL,
        subject: `Share Your Experience - ${order.order_details.items[0]?.name || 'Event Services'} Event`,
        html: html,
      };

      await EmailService.sendCustomerEmailWithAdminCopy(mailOptions, 'review request email');
      logger.info(`Review request email sent to ${order.email}`);
    } catch (error) {
      logger.error('Error sending review request email:', error);
      throw new AppError('Error sending review request email', 500);
    }
  }

  static async sendCalendarInvite(order) {
    try {
      logger.info('Starting calendar invite generation for order:', { 
        orderId: order.id,
        eventDate: order.event_date,
        eventTime: order.event_time,
      });
      
      // Parse event date and time with proper timezone handling using Luxon
      let eventStart;
      try {
        // Handle both Date objects and string dates
        let dateStr;
        if (order.event_date instanceof Date) {
          // If it's a Date object, convert to ISO string and get date part
          dateStr = order.event_date.toISOString().split('T')[0];
        } else if (typeof order.event_date === 'string') {
          // If it's a string, check if it's ISO format
          dateStr = order.event_date.includes('T') 
            ? order.event_date.split('T')[0]
            : order.event_date;
        } else {
          throw new Error('Invalid event date format');
        }

        // Ensure time is in correct format
        const timeStr = order.event_time.includes(':') ? order.event_time : `${order.event_time}:00`;
        
        // Create the datetime string
        const dateTimeStr = `${dateStr}T${timeStr}`;
        
        logger.info('Attempting to parse datetime:', {
          dateTimeStr,
          timezone: process.env.EVENT_TIMEZONE || 'America/New_York',
          originalDate: order.event_date,
          originalTime: order.event_time,
        });

        eventStart = DateTime.fromISO(dateTimeStr, {
          zone: process.env.EVENT_TIMEZONE || 'America/New_York',
        });

        logger.info('Parsed event datetime:', {
          originalDate: order.event_date,
          originalTime: order.event_time,
          parsedDateTime: eventStart.toISO(),
          isValid: eventStart.isValid,
          timezone: eventStart.zoneName,
        });

        if (!eventStart.isValid) {
          throw new Error(`Invalid datetime: ${dateTimeStr}`);
        }
      } catch (parseError) {
        logger.error('Error parsing event datetime:', {
          error: parseError.message,
          eventDate: order.event_date,
          eventTime: order.event_time,
          eventDateType: typeof order.event_date,
          isDateInstance: order.event_date instanceof Date,
        });
        throw new AppError('Invalid event date or time format', 400);
      }

      // Set event duration (default 2 hours)
      const eventDuration = process.env.EVENT_DURATION_HOURS || 2;
      const eventEnd = eventStart.plus({ hours: eventDuration });

      // Format dates for ICS file (YYYYMMDDTHHMMSSZ format)
      const formatDate = (dt) => dt.toUTC().toFormat('yyyyMMdd\'T\'HHmmss\'Z\'');

      // Generate .ics file content with proper line endings and formatting
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//JNV Events//Event Management//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${order.id}@jnvevents.com`,
        `DTSTAMP:${formatDate(DateTime.utc())}`,
        `DTSTART:${formatDate(eventStart)}`,
        `DTEND:${formatDate(eventEnd)}`,
        `SUMMARY:${order.order_details.items[0]?.name || 'Event Services'} Event`,
        `DESCRIPTION:Event details for ${order.customer_name}\n\nServices:\n${order.order_details.items.map((item) => `- ${item.name} (${item.quantity})`).join('\n')}`,
        'LOCATION:To be confirmed',
        `ORGANIZER;CN="JNV Events":mailto:${process.env.EMAIL_FROM}`,
        `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${order.customer_name}":mailto:jnv@jnvspectra.com`,
        'SEQUENCE:0',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      // Prepare HTML content with properly formatted times
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Event Confirmation</h2>
          <p>Dear ${order.customer_name},</p>
          <p>We are delighted to confirm your upcoming event with JNV Spectra!</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333;">Event Details:</h3>
            <p><strong>Date:</strong> ${eventStart.toFormat('EEEE, MMMM d, yyyy')}</p>
            <p><strong>Time:</strong> ${eventStart.toFormat('h:mm a')} ${eventStart.toFormat('z')}</p>
          </div>
          <p>Your calendar invite is attached to this email. Please accept it to ensure this special date is saved in your calendar.</p>
          <p>We're looking forward to creating unforgettable memories for your special occasion. Our team is already preparing to make your event extraordinary!</p>
          <p>Best regards,<br>JNV Spectra Team</p>
        </div>
      `;

      // Send email with calendar invite
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: order.email,
        bcc: ['jnv@jnvspectra.com', process.env.ADMIN_EMAIL].filter(Boolean),
        subject: `Event confirmation : ${order.customer_name} : ${eventStart.toFormat('MM/dd/yyyy')}`,
        html: htmlContent,
        attachments: [
          {
            filename: 'event_invite.ics',
            content: icsContent,
            contentType: 'text/calendar; method=PUBLISH; charset=UTF-8',
            contentDisposition: 'attachment',
          },
        ],
      };

      logger.info('Attempting to send calendar invite email:', { 
        to: mailOptions.to,
        from: mailOptions.from,
        subject: mailOptions.subject,
        eventStart: eventStart.toISO(),
        eventEnd: eventEnd.toISO(),
        timezone: eventStart.zoneName,
      });

      await EmailService.sendCustomerEmailWithAdminCopy(mailOptions, 'calendar invite email');
      logger.info(`Calendar invite sent to ${order.email} and jnv@jnvspectra.com`);
    } catch (error) {
      logger.error('Error sending calendar invite:', {
        error: error.message,
        stack: error.stack,
        orderId: order.id,
        customerEmail: order.email,
        eventDate: order.event_date,
        eventTime: order.event_time,
        eventDateType: typeof order.event_date,
        isDateInstance: order.event_date instanceof Date,
      });
      throw new AppError('Error sending calendar invite', 500);
    }
  }

  static async sendOrderCancellationEmail(order) {
    try {
      if (!order || !order.email) {
        throw new AppError('Order and email are required', 400);
      }

      const subject = `Order #${order.id} Cancellation`;
      const text = `
        Dear ${order.customer_name},

        Your order #${order.id} has been cancelled.

        Order Details:
        - Order ID: ${order.id}
        - Customer Name: ${order.customer_name}
        - Event Date: ${order.event_date}
        - Total Amount: $${order.total_amount}
        - Deposit Amount: $${order.deposit_amount}
        - Balance Amount: $${order.balance_amount}

        If you have any questions, please contact us at ${process.env.SUPPORT_EMAIL}

        Best regards,
        ${process.env.COMPANY_NAME || 'Event Management Team'}
      `;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Order Cancellation</h2>
          <p>Dear ${order.customer_name},</p>
          <p>Your order #${order.id} has been cancelled.</p>
          
          <h3>Order Details:</h3>
          <ul>
            <li><strong>Order ID:</strong> ${order.id}</li>
            <li><strong>Customer Name:</strong> ${order.customer_name}</li>
            <li><strong>Event Date:</strong> ${order.event_date}</li>
            <li><strong>Total Amount:</strong> $${order.total_amount}</li>
            <li><strong>Deposit Amount:</strong> $${order.deposit_amount}</li>
            <li><strong>Balance Amount:</strong> $${order.balance_amount}</li>
          </ul>

          <p>If you have any questions, please contact us at <a href="mailto:${process.env.SUPPORT_EMAIL}">${process.env.SUPPORT_EMAIL}</a></p>

          <p>Best regards,<br>${process.env.COMPANY_NAME || 'Event Management Team'}</p>
        </div>
      `;

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: order.email,
        bcc: process.env.ADMIN_EMAIL,
        subject,
        text,
        html,
      };

      await EmailService.sendCustomerEmailWithAdminCopy(mailOptions, 'order cancellation email');
      logger.info(`Order cancellation email sent to ${order.email}`);
    } catch (error) {
      logger.error('Error sending order cancellation email:', error);
      throw new AppError('Error sending order cancellation email', 500);
    }
  }

  static async sendContactFormEmail(formData) {
    try {
      // Read the email template
      const templatePath = path.join(__dirname, '../templates/email/contact-form.html');
      const template = fs.readFileSync(templatePath, 'utf8');
      const compiledTemplate = handlebars.compile(template);

      // Compile the template with data
      const html = compiledTemplate(formData);

      // Send email to admin
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: process.env.ADMIN_EMAIL,
        subject: `New Contact Form Submission: ${formData.subject}`,
        html: html,
        replyTo: formData.email, // Set reply-to header to the sender's email
      };

      await EmailService.sendEmail(mailOptions, 'contact form email');
      logger.info(`Contact form email sent to admin from ${formData.email}`);
    } catch (error) {
      logger.error('Error sending contact form email:', error);
      throw new AppError('Error sending contact form email', 500);
    }
  }

  static async sendBalancePaymentLinkEmail(order, balanceCheckoutLink) {
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Pay Remaining Balance</h2>
          <p>Dear ${order.customer_name},</p>
          <p>Your event order is confirmed. To complete your payment, please use the link below to pay the remaining balance:</p>
          <p><a href="${balanceCheckoutLink}" style="display:inline-block;padding:10px 20px;background:#5B4FFF;color:#fff;text-decoration:none;border-radius:5px;">Pay Balance</a></p>
          <p>If you have any questions, please contact us at ${process.env.COMPANY_EMAIL || 'info@example.com'}.</p>
          <p>Best regards,<br>${process.env.COMPANY_NAME || 'Our Company'} Team</p>
        </div>
      `;
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: order.email,
        bcc: process.env.ADMIN_EMAIL,
        subject: `Pay Remaining Balance for Your Event - ${order.customer_name}`,
        html,
      };
      await EmailService.sendCustomerEmailWithAdminCopy(mailOptions, 'balance payment link email');
      logger.info(`Balance pay link email sent to ${order.email} and ${process.env.ADMIN_EMAIL}`);
    } catch (error) {
      logger.error('Error sending balance pay link email:', error);
      throw new AppError('Error sending balance pay link email', 500);
    }
  }
}

module.exports = EmailService; 
