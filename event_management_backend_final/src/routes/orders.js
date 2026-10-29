const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const { auditAction } = require('../utils/audit');
const {
  getAllOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  getOrderInvoice,
  generateDepositPaymentLink,
  generateBalancePaymentLink,
  cancelOrder,
  generateBalanceQuotation,
  markDepositAsPaid,
  markFullPaymentAsPaid,
  generateCheckoutPaymentLink,
  updatePaymentLink,
} = require('../controllers/orderController');

// Public routes
router.get('/', getAllOrders);
router.get('/:id', getOrder);
router.post('/', auditAction('create', 'order'), createOrder);
router.put('/:id', protect, isAdmin, auditAction('update', 'order'), updateOrder);
router.delete('/:id', protect, isAdmin, auditAction('delete', 'order'), deleteOrder);
router.get('/:id/invoice', getOrderInvoice);

// Checkout payment link generation
router.post('/:id/checkout/payment-link', generateCheckoutPaymentLink);
router.put('/:id/payment-link', updatePaymentLink);

// Admin routes
router.post('/:id/generate-deposit-link', protect, isAdmin, auditAction('generate_deposit_link', 'order'), generateDepositPaymentLink);
router.post('/:id/generate-balance-link', protect, isAdmin, auditAction('generate_balance_link', 'order'), generateBalancePaymentLink);
router.post('/:id/generate-balance-quotation', protect, isAdmin, generateBalanceQuotation);
router.post('/:id/cancel', protect, isAdmin, auditAction('cancel', 'order'), cancelOrder);
router.put('/:id/mark-deposit-paid', protect, isAdmin, auditAction('mark_deposit_paid', 'order'), markDepositAsPaid);
router.put('/:id/mark-paid', protect, isAdmin, auditAction('mark_paid', 'order'), markFullPaymentAsPaid);
router.post('/:id/send-balance-link-email', require('../controllers/orderController').sendBalanceLinkEmail);

module.exports = router; 