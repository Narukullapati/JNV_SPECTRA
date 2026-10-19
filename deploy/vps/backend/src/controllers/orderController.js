const Order = require('../models/Order');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const PDFGenerator = require('../utils/pdfGenerator');
const EmailService = require('../services/emailService');
const SquareService = require('../services/squareService');

const logger = setupLogger();
const squareService = SquareService();

const order = new Order();

// Get all orders
const getAllOrders = async (req, res, next) => {
  try {
    const orders = await order.findAll(req.query);
    res.status(200).json({
      status: 'success',
      data: orders,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in getAllOrders:', error);
      next(new AppError('Error retrieving orders', 500));
    }
  }
};

// Get order by ID
const getOrder = async (req, res, next) => {
  try {
    if (!req.params.id) {
      throw new AppError('Order ID is required', 400);
    }

    const orderData = await order.findById(req.params.id);
    if (!orderData) {
      throw new AppError('Order not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: orderData,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in getOrder:', error);
      next(new AppError('Error retrieving order', 500));
    }
  }
};

// Create new order
const createOrder = async (req, res, next) => {
  try {
    // Validate order data
    if (!req.body.customer_name || !req.body.email || !req.body.event_date) {
      throw new AppError('Missing required fields', 400);
    }

    // Log validation results
    logger.info('Order validation results:', {
      total_amount_valid: req.body.total_amount > 0,
      deposit_amount_valid: req.body.deposit_amount > 0,
      balance_amount_valid: req.body.balance_amount >= 0,
      sum_valid: req.body.deposit_amount + req.body.balance_amount === req.body.total_amount,
      values: {
        total: req.body.total_amount,
        deposit: req.body.deposit_amount,
        balance: req.body.balance_amount,
        sum: req.body.deposit_amount + req.body.balance_amount,
      },
    });

    // Generate quotation template
    const quotationTemplate = PDFGenerator.generateQuotationTemplate({
      ...req.body,
      isDeposit: false, // Generate full quotation
    });

    // Create order with quotation template
    const newOrder = await order.create({
      ...req.body,
      quotation_template: quotationTemplate,
      order_status: 'pending',
    });

    logger.info('Order created successfully:', { orderId: newOrder.id });

    // Generate checkout page URL
    const checkoutUrl = `${process.env.FRONTEND_CHECKOUT_URL}/checkout/${newOrder.id}`;

    // Generate PDF for quotation
    const pdfResult = await PDFGenerator.generateQuotationPDF(quotationTemplate);

    // Send quotation email with PDF and checkout page link
    await EmailService.sendQuotationEmail(newOrder, pdfResult.pdfUrl, checkoutUrl);

    res.status(201).json({
      status: 'success',
      data: {
        order: newOrder,
        checkout_url: checkoutUrl,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in createOrder:', error);
      next(new AppError('Error creating order', 500));
    }
  }
};

// Update order
const updateOrder = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can update orders', 403);
    }

    if (!req.params.id) {
      throw new AppError('Order ID is required', 400);
    }

    const order = await order.update(req.params.id, req.body);
    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in updateOrder:', error);
      next(new AppError('Error updating order', 500));
    }
  }
};

// Delete order
const deleteOrder = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can delete orders', 403);
    }

    if (!req.params.id) {
      throw new AppError('Order ID is required', 400);
    }

    await order.delete(req.params.id);
    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in deleteOrder:', error);
      next(new AppError('Error deleting order', 500));
    }
  }
};

// Get order invoice/quotation
const getOrderInvoice = async (req, res, next) => {
  try {
    if (!req.params.id) {
      throw new AppError('Order ID is required', 400);
    }

    const orderData = await order.findById(req.params.id);
    
    let document;
    let responseData = {};

    if (orderData.order_status === 'paid') {
      // If invoice_pdf_url exists, return it directly
      if (orderData.invoice_pdf_url) {
        responseData = {
          document: orderData.invoice_template,
          pdf_url: orderData.invoice_pdf_url,
        };
      } else {
        // For backward compatibility, generate and save if missing
        document = PDFGenerator.generateInvoiceTemplate(orderData);
        const pdfResult = await PDFGenerator.generateInvoicePDF(document);
        const pdfUrl = typeof pdfResult === 'string' ? pdfResult : pdfResult.publicUrl;
        // Save to order
        await order.update(orderData.id, { invoice_pdf_url: pdfUrl });
        responseData = {
          document,
          pdf_url: pdfUrl,
        };
      }
    } else {
      // For pending/confirmed orders, use quotation template
      document = orderData.quotation_template;
      if (!document) {
        throw new AppError('Document not found', 404);
      }

      const result = await PDFGenerator.generateQuotationPDF(document);
      responseData = {
        document,
        pdf_url: result.pdfUrl,
        payment_link: result.paymentLink,
      };
    }

    // Return the response with appropriate data
    res.status(200).json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in getOrderInvoice:', error);
      next(new AppError('Error retrieving document', 500));
    }
  }
};

// Generate payment link
const generatePaymentLink = async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      throw new AppError('Unauthorized - Admin access required', 403);
    }

    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.status !== 'pending' || order.payment_option !== 'online') {
      throw new AppError('Payment link can only be generated for pending orders with online payment option', 400);
    }

    if (!squareService) {
      throw new AppError('Payment service is not available at the moment', 503);
    }

    const paymentLink = await squareService.createPaymentLink(order);
    order.payment_link = paymentLink;
    await order.save();

    res.json({
      success: true,
      data: {
        payment_link: paymentLink,
      },
    });
  } catch (error) {
    logger.error('Error generating payment link:', error);
    next(error);
  }
};

// Mark order as paid
const markOrderAsPaid = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can mark orders as paid', 403);
    }

    if (!req.params.id) {
      throw new AppError('Order ID is required', 400);
    }

    const order = await Order.findById(req.params.id);

    if (order.order_status === 'paid') {
      throw new AppError('Order is already marked as paid', 400);
    }

    if (order.order_status === 'cancelled') {
      throw new AppError('Cannot mark cancelled order as paid', 400);
    }

    // Generate invoice template
    const invoiceTemplate = generateInvoiceTemplate(order);

    // Update order status and set invoice template
    const updatedOrder = await order.update(order.id, {
      order_status: 'paid',
      invoice_template: invoiceTemplate,
    });

    // Generate PDF for invoice - gets either a string or an object with a publicUrl property
    const pdfResult = await PDFGenerator.generateInvoicePDF(invoiceTemplate);
    
    // Handle both cases - direct string URL or object with pdfUrl property
    const pdfUrl = typeof pdfResult === 'string' ? pdfResult : pdfResult.publicUrl;

    // Save invoice PDF URL to order
    const updatedOrderWithPdf = await order.update(order.id, {
      invoice_pdf_url: pdfUrl,
    });

    // Send invoice email with string URL
    await EmailService.sendInvoiceEmail(updatedOrderWithPdf, pdfUrl);

    res.status(200).json({
      status: 'success',
      data: {
        order: updatedOrder,
        invoice_pdf_url: pdfUrl,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in markOrderAsPaid:', error);
      next(new AppError('Error marking order as paid', 500));
    }
  }
};

// Helper function to generate quotation template
const generateQuotationTemplate = (orderData) => {
  const isDeposit = orderData.isDeposit;
  const amount = isDeposit ? orderData.deposit_amount : orderData.total_amount;
  const paymentType = isDeposit ? 'Deposit' : 'Final';

   return {
     documentType: 'invoice',
     companyInfo: {
       name: 'Your Company Name',
       address: 'Your Company Address',
       contact: 'Your Contact Information',
     },
     customerInfo: {
       name: orderData.customer_name,
       email: orderData.email,
       contact: orderData.contact_number,
     },
     orderDetails: {
        serviceType: orderData.service_type,
        eventDate: orderData.event_date,
        items: orderData.order_details.items || [],
        subtotal: orderData.order_details.subtotal || 0,
        taxPercentage: orderData.order_details.tax_percentage || 0,
        taxAmount: orderData.order_details.tax_amount || 0,
        tax: orderData.order_details.tax_amount || 0, // For backward compatibility
        total: amount,
        paymentType: paymentType,
        depositAmount: orderData.deposit_amount,
        balanceAmount: orderData.balance_amount,
      },
     paymentTerms: orderData.payment_option === 'online'
       ? `${paymentType} Payment Link will be provided`
       : `${paymentType} Payment to be made Offline`,
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    termsAndConditions: 'Standard terms and conditions apply',
  };
};

// Helper function to generate invoice template
const generateInvoiceTemplate = (order) => {
  return {
    documentType: 'receipt',
    companyInfo: {
      name: 'Your Company Name',
      address: 'Your Company Address',
      contact: 'Your Contact Information',
    },
    customerInfo: {
      name: order.customer_name,
      email: order.email,
      contact: order.contact_number,
    },
    orderDetails: {
       serviceType: order.service_type,
       eventDate: order.event_date,
       items: order.order_details.items || [],
       subtotal: order.order_details.subtotal || 0,
       taxPercentage: order.order_details.tax_percentage || 0,
       taxAmount: order.order_details.tax_amount || 0,
       tax: order.order_details.tax_amount || 0, // For backward compatibility
       total: order.total_amount || 0,
     },
    paymentInfo: {
      status: 'Paid',
      method: order.payment_option === 'online' ? 'Online Payment' : 'Offline Payment',
      date: new Date().toISOString(),
    },
    invoiceNumber: `INV-${order.id.slice(0, 8)}`,
    termsAndConditions: 'Standard terms and conditions apply',
  };
};

// Generate deposit payment link
const generateDepositPaymentLink = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can generate payment links', 403);
    }

    const { id } = req.params;
    const orderData = await order.findById(id);

    if (!orderData) {
      throw new AppError('Order not found', 404);
    }

    if (orderData.order_status !== 'pending') {
      throw new AppError('Payment link can only be generated for pending orders', 400);
    }

    if (!squareService) {
      throw new AppError('Payment service is not available', 503);
    }

    // Generate deposit payment link
    const depositLink = await squareService.createPaymentLink({
      ...orderData,
      amount: Math.round(Number(orderData.deposit_amount) * 100),
      paymentType: 'deposit',
    });

    // Update order with deposit payment link
    const updatedOrder = await order.update(id, {
      deposit_payment_link: depositLink,
    });

    res.status(200).json({
      status: 'success',
      data: {
        order: updatedOrder,
        deposit_payment_link: depositLink,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in generateDepositPaymentLink:', error);
      next(new AppError('Error generating deposit payment link', 500));
    }
  }
};

// Generate balance payment link
const generateBalancePaymentLink = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can generate payment links', 403);
    }

    const { id } = req.params;
    const orderData = await order.findById(id);

    if (!orderData) {
      throw new AppError('Order not found', 404);
    }

    if (orderData.order_status !== 'confirmed') {
      throw new AppError('Balance payment link can only be generated for confirmed orders', 400);
    }

    // Calculate the actual balance amount considering any custom payments
    let totalPaid = 0;
    if (orderData.payment_details?.deposit_payment) {
      totalPaid += orderData.payment_details.deposit_payment.amount / 100; // Convert from cents to dollars
    }
    if (orderData.payment_details?.balance_payment) {
      totalPaid += orderData.payment_details.balance_payment.amount / 100; // Convert from cents to dollars
    }

    const remainingBalance = orderData.total_amount - totalPaid;

    // Instead of generating a Square link, return the checkout page link for balance
    const balanceCheckoutLink = `${process.env.FRONTEND_CHECKOUT_URL}/checkout/${id}?type=balance&amount=${remainingBalance}`;

    // Optionally, you can update the order with this link if you want to store it
    await order.update(id, {
      balance_payment_link: balanceCheckoutLink,
      balance_amount: remainingBalance, // Update the balance amount in the order
    });

    res.status(200).json({
      status: 'success',
      data: {
        order: orderData,
        balance_checkout_link: balanceCheckoutLink,
        remaining_balance: remainingBalance,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in generateBalancePaymentLink:', error);
      next(new AppError('Error generating balance payment link', 500));
    }
  }
};

// Cancel order
const cancelOrder = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can cancel orders', 403);
    }

    const { id } = req.params;
    const orderData = await order.findById(id);

    if (!orderData) {
      throw new AppError('Order not found', 404);
    }

    if (orderData.order_status === 'cancelled') {
      throw new AppError('Order is already cancelled', 400);
    }

    // If deposit is paid, try to cancel payment links
    if (orderData.deposit_paid_at && squareService) {
      try {
        // Only try to cancel if payment links exist
        if (orderData.deposit_payment_link) {
          await squareService.cancelPaymentLink(orderData.deposit_payment_link);
        }
        if (orderData.balance_payment_link) {
          await squareService.cancelPaymentLink(orderData.balance_payment_link);
        }
      } catch (error) {
        logger.error('Error cancelling payment links:', error);
        // Continue with order cancellation even if payment link cancellation fails
      }
    }

    // Update order status to cancelled
    const updatedOrder = await order.update(id, {
      order_status: 'cancelled',
    });

    // Send cancellation email
    await EmailService.sendOrderCancellationEmail(updatedOrder);

    res.status(200).json({
      status: 'success',
      data: updatedOrder,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in cancelOrder:', error);
      next(new AppError('Error cancelling order', 500));
    }
  }
};

// Update the webhook handler in webhooks.js
const handleSquareWebhook = async (req, res, next) => {
  try {
    const { type, data } = req.body;

    if (type === 'payment.updated') {
      const payment = data.object.payment;
      const orderModel = new Order();
      
      // Find order by payment ID
      const { data: orders } = await orderModel.findAll({
        payment_details: JSON.stringify({ square_payment_id: payment.id }),
      });

      if (!orders || orders.length === 0) {
        throw new AppError('Order not found', 404);
      }

      const orderData = orders[0];

      if (payment.status === 'COMPLETED') {
        // Check if this is deposit or balance payment
        const isDepositPayment = payment.amount_money.amount === orderData.deposit_amount * 100;
        const isBalancePayment = payment.amount_money.amount === orderData.balance_amount * 100;

        if (isDepositPayment) {
          // Handle deposit payment
          const updatedOrder = await orderModel.update(orderData.id, {
            order_status: 'confirmed',
            deposit_paid_at: new Date(),
            payment_details: {
              ...orderData.payment_details,
              deposit_payment: {
                square_payment_id: payment.id,
                amount: payment.amount_money.amount,
                currency: payment.amount_money.currency,
                receipt_url: payment.receipt_url,
                card_details: payment.card_details,
                paid_at: new Date(),
              },
            },
          });

          // Generate and send quotation with deposit confirmation
          const quotationTemplate = generateQuotationTemplate(updatedOrder);
          const pdfResult = await PDFGenerator.generateQuotationPDF(quotationTemplate);
          await EmailService.sendQuotationEmail(updatedOrder, pdfResult.pdfUrl);

        } else if (isBalancePayment) {
          // Handle balance payment
          const updatedOrder = await orderModel.update(orderData.id, {
            order_status: 'paid',
            balance_paid_at: new Date(),
            payment_details: {
              ...orderData.payment_details,
              balance_payment: {
                square_payment_id: payment.id,
                amount: payment.amount_money.amount,
                currency: payment.amount_money.currency,
                receipt_url: payment.receipt_url,
                card_details: payment.card_details,
                paid_at: new Date(),
              },
            },
          });

          // Generate and send invoice
          const invoiceTemplate = generateInvoiceTemplate(updatedOrder);
          const pdfResult = await PDFGenerator.generateInvoicePDF(invoiceTemplate);
          await EmailService.sendInvoiceEmail(updatedOrder, pdfResult.pdfUrl);
        }
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    next(error);
  }
};

const generateBalanceQuotation = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can generate balance quotations', 403);
    }

    if (!req.params.id) {
      throw new AppError('Order ID is required', 400);
    }

    const orderData = await order.findById(req.params.id);
    if (!orderData) {
      throw new AppError('Order not found', 404);
    }

    if (orderData.order_status !== 'confirmed') {
      throw new AppError('Balance quotation can only be generated for confirmed orders', 400);
    }

    if (orderData.balance_paid_at) {
      throw new AppError('Balance has already been paid', 400);
    }

    // Generate balance quotation template using existing function
    const balanceQuotationTemplate = PDFGenerator.generateQuotationTemplate({
      ...orderData,
      isDeposit: false, // Indicate this is for balance payment
    });

    // Generate balance payment link if payment option is online
    let balancePaymentLink = null;
    if (orderData.payment_option === 'online' && squareService) {
      try {
        balancePaymentLink = await squareService.createPaymentLink(orderData, 'balance');
        await order.update(orderData.id, {
          balance_payment_link: balancePaymentLink,
        });
      } catch (error) {
        logger.error('Error generating balance payment link:', error);
        // Continue without payment link - the quotation will still be generated
      }
    }

    // Update order with new quotation template
    await order.update(req.params.id, {
      quotation_template: balanceQuotationTemplate,
    });

    // Generate PDF for balance quotation
    const pdfResult = await PDFGenerator.generateQuotationPDF({
      ...balanceQuotationTemplate,
      paymentLink: balancePaymentLink,
      isDeposit: false,
    });

    // Send balance quotation email with PDF
    await EmailService.sendQuotationEmail(orderData, pdfResult.pdfUrl);

    res.status(200).json({
      status: 'success',
      data: {
        quotation: balanceQuotationTemplate,
        pdf_url: pdfResult.pdfUrl,
        balance_payment_link: balancePaymentLink,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in generateBalanceQuotation:', error);
      next(new AppError('Error generating balance quotation', 500));
    }
  }
};

// Mark deposit as paid
const markDepositAsPaid = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can mark deposit as paid', 403);
    }

    if (!req.params.id) {
      throw new AppError('Order ID is required', 400);
    }

    const orderData = await order.findById(req.params.id);
    if (!orderData) {
      throw new AppError('Order not found', 404);
    }

    if (orderData.order_status !== 'pending') {
      throw new AppError('Deposit can only be marked as paid for pending orders', 400);
    }

    if (orderData.deposit_paid_at) {
      throw new AppError('Deposit has already been paid', 400);
    }

    // Update order status to confirmed and set deposit paid date
    const updatedOrder = await order.update(req.params.id, {
      order_status: 'confirmed',
      deposit_paid_at: new Date(),
    });

    // Generate balance quotation template
    const balanceQuotationTemplate = PDFGenerator.generateQuotationTemplate({
      ...updatedOrder,
      isDeposit: false, // Indicate this is for balance payment
    });

    // Generate balance payment link if payment option is online
    let balancePaymentLink = null;
    if (updatedOrder.payment_option === 'online' && squareService) {
      try {
        balancePaymentLink = await squareService.createPaymentLink(updatedOrder, 'balance');
        await order.update(updatedOrder.id, {
          balance_payment_link: balancePaymentLink,
        });
      } catch (error) {
        logger.error('Error generating balance payment link:', error);
        // Continue without payment link - the quotation will still be generated
      }
    }

    // Update order with new quotation template
    await order.update(updatedOrder.id, {
      quotation_template: balanceQuotationTemplate,
    });

    // Generate PDF for balance quotation
    const pdfResult = await PDFGenerator.generateQuotationPDF({
      ...balanceQuotationTemplate,
      paymentLink: balancePaymentLink,
      isDeposit: false,
    });

    // Send calendar invite
    await EmailService.sendCalendarInvite(updatedOrder);

    res.status(200).json({
      status: 'success',
      data: {
        order: updatedOrder,
        balance_quotation: {
          pdf_url: pdfResult.pdfUrl,
          payment_link: balancePaymentLink,
        },
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in markDepositAsPaid:', error);
      next(new AppError('Error marking deposit as paid', 500));
    }
  }
};

// Regenerate quotation template & PDF for an order (dev helper)
const regenerateQuotation = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) throw new AppError('Order ID is required', 400);

    const orderData = await order.findById(id);
    if (!orderData) throw new AppError('Order not found', 404);

    // Build fresh quotation template including event time
    const quotationTemplate = PDFGenerator.generateQuotationTemplate({ ...orderData, isDeposit: false });

    // Update order with new quotation template
    await order.update(id, { quotation_template: quotationTemplate });

    // Generate PDF for quotation
    const pdfResult = await PDFGenerator.generateQuotationPDF(quotationTemplate);

    res.status(200).json({ status: 'success', data: { pdfResult } });
  } catch (error) {
    next(error);
  }
};

// Mark full payment as paid
const markFullPaymentAsPaid = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role || req.user.role !== 'admin') {
      throw new AppError('Only admins can mark full payment as paid', 403);
    }

    if (!req.params.id) {
      throw new AppError('Order ID is required', 400);
    }

    const orderData = await order.findById(req.params.id);
    if (!orderData) {
      throw new AppError('Order not found', 404);
    }

    if (orderData.order_status !== 'confirmed') {
      throw new AppError('Full payment can only be marked as paid for confirmed orders', 400);
    }

    if (orderData.balance_paid_at) {
      throw new AppError('Full payment has already been paid', 400);
    }

    // Generate invoice template
    const invoiceTemplate = generateInvoiceTemplate(orderData);

    // Update order status to paid and set balance paid date
    const updatedOrder = await order.update(req.params.id, {
      order_status: 'paid',
      balance_paid_at: new Date(),
      invoice_template: invoiceTemplate,
    });

    // Generate PDF for invoice
    const pdfResult = await PDFGenerator.generateInvoicePDF(invoiceTemplate);
    const pdfUrl = typeof pdfResult === 'string' ? pdfResult : pdfResult.publicUrl;

    // Save invoice PDF URL to order
    const updatedOrderWithPdf = await order.update(updatedOrder.id, {
      invoice_pdf_url: pdfUrl,
    });

    // Send invoice email
    await EmailService.sendInvoiceEmail(updatedOrderWithPdf, pdfUrl);

    res.status(200).json({
      status: 'success',
      data: {
        order: updatedOrder,
        invoice_pdf_url: pdfUrl,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in markFullPaymentAsPaid:', error);
      next(new AppError('Error marking full payment as paid', 500));
    }
  }
};

// Generate payment link from checkout
const generateCheckoutPaymentLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentType, customAmount } = req.body;

    // Validate payment type
    if (!['deposit', 'full', 'custom'].includes(paymentType)) {
      throw new AppError('Invalid payment type', 400);
    }

    // Get order details
    const orderData = await order.findById(id);
    if (!orderData) {
      throw new AppError('Order not found', 404);
    }

    // Calculate payment amount based on type
    let paymentAmount;
    switch (paymentType) {
    case 'deposit':
      paymentAmount = orderData.deposit_amount;
      break;
    case 'full':
      paymentAmount = orderData.total_amount;
      break;
    case 'custom':
      // If this is a balance payment, allow it
      if (customAmount === orderData.balance_amount) {
        paymentAmount = customAmount;
        break;
      }
      // Otherwise, enforce deposit/full rules
      if (!customAmount || customAmount < orderData.deposit_amount) {
        throw new AppError('Custom amount must be greater than or equal to deposit amount', 400);
      }
      if (customAmount > orderData.total_amount) {
        throw new AppError('Custom amount cannot exceed total amount', 400);
      }
      paymentAmount = customAmount;
      break;
    }

    // Generate payment link using Square
    if (!squareService) {
      throw new AppError('Payment service is not available', 503);
    }

    const paymentLink = await squareService.createPaymentLink({
      ...orderData,
      amount: Math.round(Number(paymentAmount) * 100),
      paymentType,
    });

    // Update order with payment link based on payment type
    let updateData = {};
    if (paymentType === 'deposit') {
      updateData = { deposit_payment_link: paymentLink };
    } else if (paymentType === 'full') {
      updateData = { 
        deposit_payment_link: paymentLink,
        balance_payment_link: paymentLink,
      };
    } else if (paymentType === 'custom') {
      updateData = { balance_payment_link: paymentLink };
    }

    const updatedOrder = await order.update(id, updateData);

    res.status(200).json({
      status: 'success',
      data: {
        payment_link: paymentLink,
        order: updatedOrder,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in generateCheckoutPaymentLink:', error);
      next(new AppError('Error generating payment link', 500));
    }
  }
};

// Send balance checkout link email
const sendBalanceLinkEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { balance_checkout_link } = req.body;
    const orderData = await order.findById(id);
    if (!orderData) {
      throw new AppError('Order not found', 404);
    }
    if (!balance_checkout_link) {
      throw new AppError('Balance checkout link is required', 400);
    }
    // Send email to customer with the balance checkout link
    await EmailService.sendBalancePaymentLinkEmail(orderData, balance_checkout_link);
    res.status(200).json({ status: 'success', message: 'Balance pay link email sent.' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in sendBalanceLinkEmail:', error);
      next(new AppError('Error sending balance pay link email', 500));
    }
  }
};

// Update payment link
const updatePaymentLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { payment_link, payment_type } = req.body;

    if (!payment_link || !payment_type) {
      throw new AppError('Payment link and type are required', 400);
    }

    if (!['deposit', 'balance'].includes(payment_type)) {
      throw new AppError('Invalid payment type', 400);
    }

    // Get order details
    const orderData = await order.findById(id);
    if (!orderData) {
      throw new AppError('Order not found', 404);
    }

    // Validate order state
    if (payment_type === 'deposit' && orderData.order_status !== 'pending') {
      throw new AppError('Deposit payment link can only be updated for pending orders', 400);
    }

    if (payment_type === 'balance' && orderData.order_status !== 'confirmed') {
      throw new AppError('Balance payment link can only be updated for confirmed orders', 400);
    }

    // Update only the specific payment link
    const updateData = payment_type === 'deposit' 
      ? { deposit_payment_link: payment_link }
      : { balance_payment_link: payment_link };

    const updatedOrder = await order.update(id, updateData);

    res.status(200).json({
      status: 'success',
      data: {
        order: updatedOrder,
        payment_link: payment_link,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Error in updatePaymentLink:', error);
      next(new AppError('Error updating payment link', 500));
    }
  }
};

module.exports = {
  getAllOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  getOrderInvoice,
  generateDepositPaymentLink,
  generateBalancePaymentLink,
  generateBalanceQuotation,
  cancelOrder,
  handleSquareWebhook,
  markDepositAsPaid,
  markFullPaymentAsPaid,
  generateCheckoutPaymentLink,
  sendBalanceLinkEmail,
  updatePaymentLink,
  regenerateQuotation,
};