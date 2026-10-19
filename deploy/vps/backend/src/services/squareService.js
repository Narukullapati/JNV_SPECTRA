const { Client, Environment } = require('square');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

const logger = setupLogger();

class SquareService {
  constructor() {
    // Check for required environment variables
    const requiredEnvVars = [
      'SQUARE_ENVIRONMENT',
      'SQUARE_ACCESS_TOKEN',
      'SQUARE_LOCATION_ID',
      'SUPPORT_EMAIL',
      'FRONTEND_URL',
      'FRONTEND_CHECKOUT_URL',
    ];

    const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
    if (missingVars.length > 0) {
      logger.error('Missing required Square environment variables:', missingVars);
      throw new AppError(`Missing required Square environment variables: ${missingVars.join(', ')}`, 500);
    }

    try {
      this.client = new Client({
        environment: process.env.SQUARE_ENVIRONMENT === 'production' 
          ? Environment.Production 
          : Environment.Sandbox,
        accessToken: process.env.SQUARE_ACCESS_TOKEN,
      });
    } catch (error) {
      logger.error('Error initializing Square client:', error);
      throw new AppError('Error initializing Square client', 500);
    }
  }

  async createPaymentLink(order, type = 'deposit') {
    try {
      // Use the amount passed in the order object if available, otherwise fall back to deposit/balance amount
      const amount = order.amount ? order.amount / 100 : (type === 'deposit' ? order.deposit_amount : order.balance_amount);
      
      if (!amount || isNaN(amount)) {
        throw new AppError(`Invalid ${type} amount`, 400);
      }

      const { result } = await this.client.checkoutApi.createPaymentLink({
        idempotencyKey: `order_${order.id}_${type}_${Date.now()}`,
        quickPay: {
          name: `Order #${order.id} - ${type === 'deposit' ? 'Deposit' : 'Final'} Payment`,
          priceMoney: {
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'USD',
          },
          locationId: process.env.SQUARE_LOCATION_ID,
        },
        checkoutOptions: {
          askForShippingAddress: false,
          redirectUrl: `${process.env.FRONTEND_CHECKOUT_URL}/order-confirmation`,
          merchantSupportEmail: process.env.SUPPORT_EMAIL,
        },
      });

      return result.paymentLink.url;
    } catch (error) {
      logger.error(`Error creating Square ${type} payment link:`, error);
      throw new AppError(`Error creating ${type} payment link`, 500);
    }
  }

  async verifyPayment(paymentId) {
    try {
      const { result } = await this.client.paymentsApi.getPayment(paymentId);
      return result.payment.status === 'COMPLETED';
    } catch (error) {
      logger.error('Error verifying Square payment:', error);
      throw new AppError('Error verifying payment', 500);
    }
  }

  async cancelPaymentLink(paymentLink) {
    try {
      if (!paymentLink) {
        throw new AppError('Payment link is required', 400);
      }

      // Extract payment link ID from the URL
      const paymentLinkId = paymentLink.split('/').pop();
      
      // Cancel the payment link
      await this.client.checkoutApi.deletePaymentLink(paymentLinkId);
      
      return true;
    } catch (error) {
      logger.error('Error cancelling Square payment link:', error);
      throw new AppError('Error cancelling payment link', 500);
    }
  }
}

// Export a function that creates the service instance
module.exports = () => {
  try {
    return new SquareService();
  } catch (error) {
    logger.error('Failed to initialize Square service:', error);
    return null;
  }
}; 