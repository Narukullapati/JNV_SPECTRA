const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { AppError } = require('../utils/AppError');
const Order = require('../models/Order');
const { logger } = require('../utils/logger');
const PDFGenerator = require('../utils/pdfGenerator');
const EmailService = require('../services/emailService');

// Test endpoint to verify webhook router is mounted
router.get('/test', (req, res) => {
  console.log('Test endpoint hit');
  res.status(200).json({ status: 'success', message: 'Webhook router is working' });
});

// Debug middleware to log all webhook requests
router.use((req, res, next) => {
  console.log('Webhook request received:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    headers: req.headers,
    host: req.get('host'),
    'x-forwarded-proto': req.get('x-forwarded-proto'),
  });
  next();
});

// Verify Square webhook signature
const verifySquareWebhook = (req, res, next) => {
  try {
    const signature = req.headers['x-square-hmacsha256-signature'];
    if (!signature) {
      console.log('Missing Square signature in headers:', req.headers);
      throw new AppError('Missing Square signature', 401);
    }

    const webhookKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (!webhookKey) {
      console.error('Square webhook signature key not configured');
      throw new AppError('Square webhook signature key not configured', 500);
    }

    // Get the raw request body
    const rawBody = req.body;
    console.log('=== Raw Webhook Payload ===');
    console.log('Raw body type:', typeof rawBody);
    console.log('Raw body:', rawBody);
    console.log('==========================');

    // Convert raw body to string for signature verification
    const payload = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    console.log('=== Stringified Payload ===');
    console.log('Payload type:', typeof payload);
    console.log('Payload length:', payload.length);
    console.log('Payload content:', payload);
    console.log('==========================');

    // Try to parse the payload
    let parsedPayload;
    try {
      parsedPayload = typeof rawBody === 'object' ? rawBody : JSON.parse(payload);
      console.log('=== Parsed Webhook Payload ===');
      console.log(JSON.stringify(parsedPayload, null, 2));
      console.log('============================');
    } catch (parseError) {
      console.error('Error parsing payload:', parseError);
      console.error('Failed payload content:', payload);
      throw new AppError('Invalid webhook payload', 400);
    }

    // Get the request URL for signature verification
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const requestUrl = `${protocol}://${req.get('host')}${req.originalUrl}`;
    console.log('Using request URL for signature:', requestUrl);

    // Create HMAC with request URL and payload
    const hmac = crypto.createHmac('sha256', webhookKey);
    hmac.update(requestUrl + payload);
    const calculatedSignature = hmac.digest('base64');

    console.log('=== Signature Verification ===');
    console.log('Received Signature:', signature);
    console.log('Calculated Signature:', calculatedSignature);
    console.log('Request URL:', requestUrl);
    console.log('Protocol:', protocol);
    console.log('Webhook Key (first 10 chars):', webhookKey.substring(0, 10) + '...');
    console.log('============================');

    if (signature !== calculatedSignature) {
      console.warn('Invalid Square signature:', {
        received: signature,
        calculated: calculatedSignature,
        requestUrl,
        protocol,
      });
      throw new AppError('Invalid Square signature', 401);
    }

    // Store the parsed body for the route handler
    req.body = parsedPayload;
    next();
  } catch (error) {
    console.error('Webhook verification error:', error);
    next(error);
  }
};

// Handle Square payment webhook
router.post('/square', express.raw({ type: 'application/json' }), verifySquareWebhook, async (req, res, next) => {
  try {
    const { type, data } = req.body;
    console.log('Processing Square webhook:', { 
      type,
      data: JSON.stringify(data, null, 2),
    });

    // Send immediate response to Square
    res.status(200).json({ status: 'success' });

    // Process the webhook asynchronously
    process.nextTick(async () => {
      try {
        // Handle payment.updated event
        if (type === 'payment.updated') {
          const payment = data.object.payment;
          
          if (!payment.order_id) {
            console.error('Missing order ID in payment webhook');
            return;
          }

          // Find order by Square order ID
          const orderModel = new Order();
          const { data: orders } = await orderModel.findAll({
            payment_details: JSON.stringify({ square_order_id: payment.order_id }),
          });
          
          if (!orders || orders.length === 0) {
            console.warn(`Order not found for Square order ID: ${payment.order_id}`);
            return;
          }

          const order = orders[0];

          // Update order status based on payment status
          if (payment.status === 'COMPLETED') {
            // Check if this is deposit or balance payment
            const isDepositPayment = payment.amount_money.amount === order.deposit_amount * 100;
            const isBalancePayment = payment.amount_money.amount === order.balance_amount * 100;
            const isCustomPayment = !isDepositPayment && !isBalancePayment;
            const customAmount = payment.amount_money.amount / 100; // Convert to dollars
            const totalAmount = order.total_amount;
            const depositAmount = order.deposit_amount;

            if (isDepositPayment || (isCustomPayment && customAmount < totalAmount && customAmount >= depositAmount)) {
              // Handle deposit payment or partial custom payment
              const updatedOrder = await orderModel.update(order.id, {
                order_status: 'confirmed',
                deposit_paid_at: new Date(),
                payment_details: {
                  ...order.payment_details,
                  deposit_payment: {
                    square_payment_id: payment.id,
                    square_order_id: payment.order_id,
                    amount: payment.amount_money.amount,
                    currency: payment.amount_money.currency,
                    receipt_url: payment.receipt_url,
                    card_details: {
                      last_4: payment.card_details?.card?.last_4,
                      card_brand: payment.card_details?.card?.card_brand,
                      exp_month: payment.card_details?.card?.exp_month,
                      exp_year: payment.card_details?.card?.exp_year,
                    },
                    paid_at: new Date(),
                  },
                },
              });

              // Send calendar invite - handle errors gracefully
              try {
                await EmailService.sendCalendarInvite(updatedOrder);
                console.log(`Calendar invite sent for order ${updatedOrder.id}`);
              } catch (calendarError) {
                console.error(`Error sending calendar invite for order ${updatedOrder.id}:`, calendarError);
                // Continue with the webhook process even if calendar invite fails
              }

              console.log(`Order ${updatedOrder.id} ${isDepositPayment ? 'deposit' : 'partial custom'} payment paid and marked as confirmed`);
            } else if (isBalancePayment || (isCustomPayment && customAmount >= totalAmount)) {
              // Handle balance payment or full custom payment
              const updatedOrder = await orderModel.update(order.id, {
                order_status: 'paid',
                balance_paid_at: new Date(),
                payment_details: {
                  ...order.payment_details,
                  balance_payment: {
                    square_payment_id: payment.id,
                    square_order_id: payment.order_id,
                    amount: payment.amount_money.amount,
                    currency: payment.amount_money.currency,
                    receipt_url: payment.receipt_url,
                    card_details: {
                      last_4: payment.card_details?.card?.last_4,
                      card_brand: payment.card_details?.card?.card_brand,
                      exp_month: payment.card_details?.card?.exp_month,
                      exp_year: payment.card_details?.card?.exp_year,
                    },
                    paid_at: new Date(),
                  },
                },
              });

              // Generate and send invoice
              const invoiceTemplate = PDFGenerator.generateInvoiceTemplate(updatedOrder);
              const pdfResult = await PDFGenerator.generateInvoicePDF(invoiceTemplate);
              const pdfUrl = typeof pdfResult === 'string' ? pdfResult : pdfResult.publicUrl;
              await EmailService.sendInvoiceEmail(updatedOrder, pdfUrl);

              console.log(`Order ${updatedOrder.id} ${isBalancePayment ? 'balance' : 'full custom'} payment paid and marked as paid`);
            }
          } else if (payment.status === 'FAILED') {
            const updatedOrder = await orderModel.update(order.id, {
              order_status: 'payment_failed',
              payment_details: {
                ...order.payment_details,
                last_payment_attempt: {
                  square_payment_id: payment.id,
                  square_order_id: payment.order_id,
                  status: 'failed',
                  last_updated: new Date(),
                },
              },
            });
            console.log(`Order ${updatedOrder.id} payment failed`);
          }
        }
      } catch (error) {
        console.error('Error processing Square webhook asynchronously:', error);
      }
    });
  } catch (error) {
    console.error('Error in Square webhook handler:', error);
    // Still send success response to prevent retries
    res.status(200).json({ status: 'success' });
  }
});

module.exports = router; 