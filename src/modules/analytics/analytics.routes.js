// src/modules/analytics/analytics.routes.js
const express = require('express');
const router = express.Router();
const analyticsService = require('./analytics.service');
const ApiResponse = require('../../shared/response');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { PERMISSIONS } = require('../../shared/constants');

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Analytics and Reporting
 */

router.use(authenticate);

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard KPIs
 *     tags: [Analytics]
 */
router.get('/dashboard', async (req, res) => {
  const kpis = await analyticsService.getDashboardKPIs(req.user.id, req.user.role?.name);
  ApiResponse.success(res, { data: kpis });
});

/**
 * @swagger
 * /analytics/ticket-trends:
 *   get:
 *     summary: Get ticket volume trends over time
 *     tags: [Analytics]
 */
router.get('/ticket-trends', authorize(PERMISSIONS.ANALYTICS_READ), async (req, res) => {
  const trends = await analyticsService.getTicketTrends(req.query);
  ApiResponse.success(res, { data: trends });
});

/**
 * @swagger
 * /analytics/technician-performance:
 *   get:
 *     summary: Get technician performance metrics
 *     tags: [Analytics]
 */
router.get('/technician-performance', authorize(PERMISSIONS.ANALYTICS_READ), async (req, res) => {
  const performance = await analyticsService.getTechnicianPerformance(req.query);
  ApiResponse.success(res, { data: performance });
});

/**
 * @swagger
 * /analytics/resolution-times:
 *   get:
 *     summary: Get resolution time analysis
 *     tags: [Analytics]
 */
router.get('/resolution-times', authorize(PERMISSIONS.ANALYTICS_READ), async (req, res) => {
  const report = await analyticsService.getResolutionTimeReport(req.query);
  ApiResponse.success(res, { data: report });
});

/**
 * @swagger
 * /analytics/category-breakdown:
 *   get:
 *     summary: Get ticket category breakdown
 *     tags: [Analytics]
 */
router.get('/category-breakdown', authorize(PERMISSIONS.ANALYTICS_READ), async (req, res) => {
  const breakdown = await analyticsService.getCategoryBreakdown(req.query);
  ApiResponse.success(res, { data: breakdown });
});

/**
 * @swagger
 * /analytics/export:
 *   get:
 *     summary: Export analytics data as JSON
 *     tags: [Analytics]
 */
router.get('/export', authorize(PERMISSIONS.ANALYTICS_EXPORT), async (req, res) => {
  const { type = 'dashboard', from, to } = req.query;
  let data;

  if (type === 'trends') data = await analyticsService.getTicketTrends({ from, to });
  else if (type === 'performance') data = await analyticsService.getTechnicianPerformance({ from, to });
  else if (type === 'resolution') data = await analyticsService.getResolutionTimeReport({ from, to });
  else if (type === 'category') data = await analyticsService.getCategoryBreakdown({ from, to });
  else data = await analyticsService.getDashboardKPIs(req.user.id, req.user.role?.name);

  res.setHeader('Content-Disposition', `attachment; filename="itsm-analytics-${type}-${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json({ success: true, exportedAt: new Date(), type, data });
});

module.exports = router;
