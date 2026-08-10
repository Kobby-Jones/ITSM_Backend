// src/modules/sla/sla.routes.js
const express = require('express');
const router = express.Router();
const slaService = require('./sla.service');
const ApiResponse = require('../../shared/response');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/index');
const { PERMISSIONS } = require('../../shared/constants');
const Joi = require('joi');

/**
 * @swagger
 * tags:
 *   name: SLA
 *   description: SLA Configuration and Management
 */

router.use(authenticate);

/**
 * @swagger
 * /sla/configurations:
 *   get:
 *     summary: Get all SLA configurations
 *     tags: [SLA]
 */
router.get('/configurations', async (req, res) => {
  const configs = await slaService.getSLAConfigurations();
  ApiResponse.success(res, { data: configs });
});

/**
 * @swagger
 * /sla/configurations/{priority}:
 *   put:
 *     summary: Update SLA configuration for a priority
 *     tags: [SLA]
 */
router.put('/configurations/:priority',
  authorize(PERMISSIONS.SYSTEM_SLA),
  validate(Joi.object({
    responseTimeMinutes: Joi.number().integer().min(1).required(),
    resolutionTimeMinutes: Joi.number().integer().min(1).required(),
    warningThresholdPct: Joi.number().integer().min(1).max(100).default(80),
    isActive: Joi.boolean(),
  }), 'body'),
  async (req, res) => {
    const valid = ['P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW'];
    if (!valid.includes(req.params.priority)) {
      return ApiResponse.badRequest(res, { message: 'Invalid priority level' });
    }
    const config = await slaService.updateSLAConfiguration(req.params.priority, req.body);
    ApiResponse.success(res, { message: 'SLA configuration updated', data: config });
  }
);

/**
 * @swagger
 * /sla/tickets/{id}/status:
 *   get:
 *     summary: Get SLA status for a ticket
 *     tags: [SLA]
 */
router.get('/tickets/:id/status', async (req, res) => {
  const { prisma } = require('../../config/database');
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!ticket) return ApiResponse.notFound(res, { message: 'Ticket not found' });
  const status = await slaService.getSLAStatus(ticket);
  ApiResponse.success(res, { data: status });
});

/**
 * @swagger
 * /sla/report:
 *   get:
 *     summary: Get SLA compliance report
 *     tags: [SLA]
 */
router.get('/report',
  authorize(PERMISSIONS.ANALYTICS_READ),
  async (req, res) => {
    const { from, to } = req.query;
    const report = await slaService.getSLAReport(from, to);
    ApiResponse.success(res, { data: report });
  }
);

/**
 * @swagger
 * /sla/check:
 *   post:
 *     summary: Manually trigger SLA breach check
 *     tags: [SLA]
 */
router.post('/check',
  authorize(PERMISSIONS.SYSTEM_SLA),
  async (req, res) => {
    const result = await slaService.checkSLABreaches();
    ApiResponse.success(res, { message: 'SLA check completed', data: result });
  }
);

module.exports = router;
