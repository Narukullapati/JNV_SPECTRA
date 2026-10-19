const fs = require('fs');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();
const publicEmailDomains = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'aol.com',
]);

const resendApiKey = process.env.RESEND_API_KEY;
const smtpConfigured = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS,
);

const resend = resendApiKey ? new Resend(resendApiKey) : null;
const smtpTransport = smtpConfigured
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  : null;

const normalizeAddresses = (value) => {
  if (!value) {
    return [];
  }

  const addresses = Array.isArray(value) ? value : [value];
  return addresses
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const formatFromAddress = (from) => {
  const email = from || process.env.EMAIL_FROM;
  const name = process.env.EMAIL_FROM_NAME;

  if (!email) {
    throw new AppError('EMAIL_FROM is not configured', 500);
  }

  if (!name) {
    return email;
  }

  return `${name} <${email}>`;
};

const extractEmailAddress = (value) => {
  if (!value) {
    return '';
  }

  const match = String(value).match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
};

const isRemoteFile = (value) => /^https?:\/\//i.test(String(value || ''));

const resolveResendFromAddress = (from) => {
  const sender = extractEmailAddress(from || process.env.EMAIL_FROM);
  const domain = sender.split('@')[1];
  const resendFrom = process.env.RESEND_FROM_EMAIL || process.env.COMPANY_EMAIL;

  if (resendFrom && publicEmailDomains.has(domain) && resendFrom.toLowerCase() !== sender) {
    logger.warn('Overriding sender for Resend with a business address', {
      originalFrom: sender,
      resendFrom,
    });
    return formatFromAddress(resendFrom);
  }

  return from;
};

const prepareMailOptions = (mailOptions) => {
  const to = normalizeAddresses(mailOptions.to);
  const cc = normalizeAddresses(mailOptions.cc);
  const bcc = normalizeAddresses(mailOptions.bcc);

  if (!to.length) {
    throw new AppError('No recipient email address was provided', 400);
  }

  return {
    ...mailOptions,
    from: formatFromAddress(mailOptions.from),
    to,
    cc,
    bcc,
  };
};

const cloneAttachments = (attachments = []) => attachments.map((attachment) => {
  if (!attachment) {
    return attachment;
  }

  return {
    ...attachment,
    content: Buffer.isBuffer(attachment.content)
      ? Buffer.from(attachment.content)
      : attachment.content,
  };
});

const normalizeResendAttachment = async (attachment) => {
  if (!attachment) {
    return null;
  }

  const normalized = {};

  if (attachment.filename) {
    normalized.filename = attachment.filename;
  }

  if (attachment.contentType) {
    normalized.contentType = attachment.contentType;
  }

  if (Buffer.isBuffer(attachment.content)) {
    normalized.content = attachment.content.toString('base64');
    return normalized;
  }

  if (typeof attachment.content === 'string' && attachment.content.length) {
    normalized.content = attachment.content;
    return normalized;
  }

  if (attachment.path) {
    if (isRemoteFile(attachment.path)) {
      const response = await fetch(attachment.path);

      if (!response.ok) {
        throw new Error(`Failed to fetch attachment from ${attachment.path} (${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      normalized.content = Buffer.from(arrayBuffer).toString('base64');
      return normalized;
    }

    normalized.content = fs.readFileSync(attachment.path).toString('base64');
    return normalized;
  }

  throw new Error(
    `Attachment "${attachment.filename || 'unnamed'}" is missing content and path for Resend`,
  );
};

const normalizeResendAttachments = async (attachments = []) => {
  const normalized = await Promise.all(
    attachments
      .filter(Boolean)
      .map((attachment) => normalizeResendAttachment(attachment)),
  );

  return normalized.length ? normalized : undefined;
};

const verifyConnection = async () => {
  if (resend) {
    try {
      const response = await fetch('https://api.resend.com/domains', {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
        },
      });

      if (!response.ok) {
        const details = await response.text();
        logger.error('Resend API authentication failed:', {
          status: response.status,
          details,
        });
      } else {
        logger.info('Resend API authentication succeeded');
      }
    } catch (error) {
      logger.error('Resend API connection error:', error);
    }
  } else {
    logger.warn('RESEND_API_KEY is not configured; Resend delivery is disabled');
  }

  if (smtpTransport) {
    try {
      await smtpTransport.verify();
      logger.info('SMTP transport verification succeeded');
    } catch (error) {
      logger.error('SMTP transport verification failed:', error);
    }
  } else {
    logger.warn('SMTP transport is not configured');
  }
};

const sendViaResend = async (mailOptions, context) => {
  if (!resend) {
    throw new Error('Resend transport is not configured');
  }

  const resendMailOptions = {
    ...mailOptions,
    from: resolveResendFromAddress(mailOptions.from),
    attachments: await normalizeResendAttachments(cloneAttachments(mailOptions.attachments)),
  };

  const result = await resend.emails.send({
    ...resendMailOptions,
  });

  if (result?.error) {
    throw new Error(result.error.message || `Resend rejected ${context}`);
  }

  logger.info(`Email accepted via Resend for ${context}:`, {
    id: result?.data?.id,
    to: resendMailOptions.to,
    cc: resendMailOptions.cc,
    bcc: resendMailOptions.bcc,
    from: resendMailOptions.from,
    subject: resendMailOptions.subject,
  });

  return {
    transport: 'resend',
    id: result?.data?.id,
  };
};

const sendViaSmtp = async (mailOptions, context) => {
  if (!smtpTransport) {
    throw new Error('SMTP transport is not configured');
  }

  const info = await smtpTransport.sendMail({
    ...mailOptions,
    attachments: cloneAttachments(mailOptions.attachments),
    to: mailOptions.to.join(', '),
    cc: mailOptions.cc.length ? mailOptions.cc.join(', ') : undefined,
    bcc: mailOptions.bcc.length ? mailOptions.bcc.join(', ') : undefined,
  });

  logger.info(`Email accepted via SMTP for ${context}:`, {
    messageId: info.messageId,
    response: info.response,
    to: mailOptions.to,
    cc: mailOptions.cc,
    bcc: mailOptions.bcc,
    from: mailOptions.from,
    subject: mailOptions.subject,
  });

  return {
    transport: 'smtp',
    id: info.messageId,
  };
};

const sendEmail = async (mailOptions, context = 'email', options = {}) => {
  const prepared = prepareMailOptions(mailOptions);
  const errors = [];
  const preferredTransport = options.preferredTransport;
  const transports = preferredTransport === 'smtp'
    ? ['smtp', 'resend']
    : ['resend', 'smtp'];

  for (const transport of transports) {
    if (transport === 'resend' && resend) {
      try {
        return await sendViaResend(prepared, context);
      } catch (error) {
        errors.push(`Resend: ${error.message}`);
        logger.warn(`Resend delivery failed for ${context}, falling back if available:`, {
          error: error.message,
          to: prepared.to,
          subject: prepared.subject,
        });
      }
    }

    if (transport === 'smtp' && smtpTransport) {
      try {
        return await sendViaSmtp(prepared, context);
      } catch (error) {
        errors.push(`SMTP: ${error.message}`);
        logger.error(`SMTP delivery failed for ${context}:`, {
          error: error.message,
          to: prepared.to,
          subject: prepared.subject,
        });
      }
    }
  }

  throw new AppError(
    `Unable to send ${context}. ${errors.join(' | ') || 'No email transport is configured.'}`,
    500,
  );
};

verifyConnection();

module.exports = {
  sendEmail,
  formatFromAddress,
};
