const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
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
router.post('/', createOrder);
router.put('/:id', protect, isAdmin, updateOrder);
router.delete('/:id', protect, isAdmin, deleteOrder);
router.get('/:id/invoice', getOrderInvoice);

// Checkout payment link generation
router.post('/:id/checkout/payment-link', generateCheckoutPaymentLink);
router.put('/:id/payment-link', updatePaymentLink);

// Admin routes
router.post('/:id/generate-deposit-link', protect, isAdmin, generateDepositPaymentLink);
router.post('/:id/generate-balance-link', protect, isAdmin, generateBalancePaymentLink);
router.post('/:id/generate-balance-quotation', protect, isAdmin, generateBalanceQuotation);
router.post('/:id/cancel', protect, isAdmin, cancelOrder);
router.put('/:id/mark-deposit-paid', protect, isAdmin, markDepositAsPaid);
router.put('/:id/mark-paid', protect, isAdmin, markFullPaymentAsPaid);
router.post('/:id/send-balance-link-email', require('../controllers/orderController').sendBalanceLinkEmail);

module.exports = router; 