const Order = require('../models/Order');
const EventsHosted = require('../models/EventsHosted');
const Service = require('../models/Service');
const EventPlanning = require('../models/EventPlanning');
const { AppError } = require('../utils/AppError');
const { setupLogger } = require('../utils/logger');

const logger = setupLogger();

const order = new Order();
const eventsHosted = new EventsHosted();
const service = new Service();

const parseDateBoundary = (value, boundary) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (boundary === 'start') {
    parsed.setHours(0, 0, 0, 0);
  } else {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
};

/**
 * Get dashboard analytics data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const timeFrame = req.query.timeFrame || '30'; // Default to 30 days
    const days = parseInt(timeFrame);
    const customStartDate = parseDateBoundary(req.query.fromDate, 'start');
    const customEndDate = parseDateBoundary(req.query.toDate, 'end');

    if ((req.query.fromDate && !customStartDate) || (req.query.toDate && !customEndDate)) {
      throw new AppError('Invalid date range provided', 400);
    }

    if (customStartDate && customEndDate && customStartDate > customEndDate) {
      throw new AppError('From Date must be before or equal to To Date', 400);
    }

    let startDate;
    let endDate;

    if (customStartDate || customEndDate) {
      startDate = customStartDate || (() => {
        const fallback = new Date(customEndDate);
        fallback.setDate(fallback.getDate() - days);
        fallback.setHours(0, 0, 0, 0);
        return fallback;
      })();

      endDate = customEndDate || (() => {
        const fallback = new Date();
        fallback.setHours(23, 59, 59, 999);
        return fallback;
      })();
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }
    
    // Format dates for database queries
    const formattedStartDate = startDate.toISOString();
    const formattedEndDate = endDate.toISOString();
    
    // Get orders in the time frame with proper date filtering
    const ordersResult = await order.findAll({
      created_at_gte: formattedStartDate,
      created_at_lte: formattedEndDate,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    
    logger.info(`Found ${ordersResult.data.length} orders in the specified time frame`);
    
    // Get hosted events in the same date window
    const eventsResult = await eventsHosted.findAll({
      start_date: formattedStartDate.split('T')[0],
      end_date: formattedEndDate.split('T')[0],
      sort_by: 'event_date',
      sort_order: 'asc',
      limit: 1000,
    });

    logger.info(`Found ${eventsResult.data.length} events in the specified time frame`);
    
    // Calculate total revenue from completed orders (both paid and completed status)
    const totalRevenue = ordersResult.data
      .filter((order) => ['paid', 'completed'].includes(order.order_status))
      .reduce((sum, order) => {
        // Calculate total from subtotal and tax if total is not available
        const subtotal = order.order_details?.subtotal || 0;
        const tax = order.order_details?.tax || 0;
        return sum + (order.order_details?.total || (subtotal + tax));
      }, 0);
    
    // Count new orders in the last 7 days
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const newOrders = ordersResult.data.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate >= last7Days;
    }).length;
    
    // Get active services count - direct DB query with proper filter
    let activeServices = 0;
    try {
      const servicesData = await service.findAll({ 
        status: 'active',
      });
      activeServices = servicesData.data.length; // Access the data array
      logger.info(`Found ${activeServices} active services in the database`);
    } catch (error) {
      logger.error('Error getting active services count:', error);
      throw new AppError('Failed to get active services count', 500);
    }
    
    // Get active events count from event planning table
    const today = new Date();
    let activeEvents = 0;
    try {
      const activeEventsData = await EventPlanning.findAll({
        status: 'active',
      });
      
      activeEvents = activeEventsData.data.length;
      logger.info(`Found ${activeEvents} active events in the event planning table`);
    } catch (error) {
      logger.error('Error getting active events count from event planning:', error);
      // Fallback to events hosted table if event planning fails
      try {
        const hostedEvents = await eventsHosted.findAll({
          status: 'active',
        });
        activeEvents = hostedEvents.data.length;
        logger.info(`Falling back to events hosted table, found ${activeEvents} active events`);
      } catch (fallbackError) {
        logger.error('Error in fallback to events hosted:', fallbackError);
        throw new AppError('Failed to get active events count', 500);
      }
    }
    
    // Get recent orders for display
    const recentOrders = ordersResult.data
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        customer: order.customer_name,
        order_details: order.order_details,
        date: order.created_at,
        status: order.order_status === 'paid' || order.order_status === 'completed' ? 'completed' : 
          order.order_status === 'cancelled' ? 'cancelled' : 'pending',
        total: (order.order_details?.subtotal || 0) + (order.order_details?.tax || 0),
      }));
    
    // Calculate trends (percentage change)
    // For previous period, we need date comparisons rather than additional API calls
    
    // Get previous period order data
    const rangeDurationMs = endDate.getTime() - startDate.getTime() + 1;
    const previousPeriodEndDate = new Date(startDate.getTime() - 1);
    const previousPeriodStartDate = new Date(previousPeriodEndDate.getTime() - rangeDurationMs + 1);
    
    // Get previous period orders with proper date filtering
    const previousOrdersResult = await order.findAll({
      created_at_gte: previousPeriodStartDate.toISOString(),
      created_at_lte: previousPeriodEndDate.toISOString(),
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    
    // Calculate previous period metrics
    const previousRevenue = previousOrdersResult.data
      .filter((order) => ['paid', 'completed'].includes(order.order_status))
      .reduce((sum, order) => {
        const subtotal = order.order_details?.subtotal || 0;
        const tax = order.order_details?.tax || 0;
        return sum + (order.order_details?.total || (subtotal + tax));
      }, 0);
    
    // Get previous active services count
    let previousActiveServices = 0;
    try {
      const previousServicesData = await service.findAll({
        status: 'active',
      });
      previousActiveServices = previousServicesData.data.length;
    } catch (error) {
      logger.error('Error calculating previous active services:', error);
      previousActiveServices = 0;
    }
    
    const previousPeriodLast7Days = new Date(last7Days);
    previousPeriodLast7Days.setDate(previousPeriodLast7Days.getDate() - 7);
    const previousNewOrders = previousOrdersResult.data.filter((order) => {
      const orderDate = new Date(order.created_at);
      return orderDate >= previousPeriodLast7Days && orderDate < last7Days;
    }).length;
    
    // Get previous active events count
    let previousActiveEvents = 0;
    try {
      const previousEventsData = await EventPlanning.findAll({
        status: 'active',
      });
      previousActiveEvents = previousEventsData.data.length;
    } catch (error) {
      logger.error('Error calculating previous active events:', error);
      // Fallback to events hosted table
      try {
        const previousHostedEvents = await eventsHosted.findAll({
          status: 'active',
        });
        previousActiveEvents = previousHostedEvents.data.length;
      } catch (fallbackError) {
        logger.error('Error in fallback to events hosted for previous period:', fallbackError);
        previousActiveEvents = 0;
      }
    }
    
    // Calculate trend percentages with better safeguards
    const calculateTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };
    
    const revenueTrend = calculateTrend(totalRevenue, previousRevenue);
    const servicesTrend = calculateTrend(activeServices, previousActiveServices);
    const newOrdersTrend = calculateTrend(newOrders, previousNewOrders);
    const activeEventsTrend = calculateTrend(activeEvents, previousActiveEvents);
    
    // Log analytics data for debugging
    logger.info(`Analytics calculated - Revenue: ${totalRevenue}, Services: ${activeServices}, New Orders: ${newOrders}, Active Events: ${activeEvents}`);
    
    // Return analytics data
    res.status(200).json({
      status: 'success',
      data: {
        totalRevenue: {
          value: totalRevenue,
          trend: {
            value: Math.abs(revenueTrend),
            isPositive: revenueTrend >= 0,
          },
        },
        activeServices: {
          value: activeServices,
          trend: {
            value: Math.abs(servicesTrend),
            isPositive: servicesTrend >= 0,
          },
        },
        newOrders: {
          value: newOrders,
          trend: {
            value: Math.abs(newOrdersTrend),
            isPositive: newOrdersTrend >= 0,
          },
        },
        activeEvents: {
          value: activeEvents,
          trend: {
            value: Math.abs(activeEventsTrend),
            isPositive: activeEventsTrend >= 0,
          },
        },
        recentOrders,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to get dashboard analytics', 500));
    }
  }
};

module.exports = {
  getDashboardStats,
}; 
