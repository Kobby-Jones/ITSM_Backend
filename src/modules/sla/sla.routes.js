// src/modules/sla/sla.routes.js
const express = require('express');
const Joi = require('joi');

const router = express.Router();

const slaService = require('./sla.service');
const ApiResponse = require('../../shared/response');

const {
  authenticate,
  authorize,
} = require('../../middleware/auth.middleware');

const {
  validate,
} = require('../../middleware/index');

const {
  PERMISSIONS,
} = require('../../shared/constants');

const {
  assertCanReadTicket,
} = require('../../policies/ticket.policy');

const {
  prisma,
} = require('../../config/database');

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
router.get(
  '/configurations',
  async (req, res) => {
    const configurations =
      await slaService.getSLAConfigurations();

    ApiResponse.success(res, {
      data: configurations,
    });
  }
);

/**
 * @swagger
 * /sla/configurations/{priority}:
 *   put:
 *     summary: Update SLA configuration
 *     tags: [SLA]
 */
router.put(
  '/configurations/:priority',

  authorize(PERMISSIONS.SYSTEM_SLA),

  validate(
    Joi.object({
      responseTimeMinutes: Joi.number()
        .integer()
        .min(1)
        .required(),

      resolutionTimeMinutes: Joi.number()
        .integer()
        .min(1)
        .required(),

      warningThresholdPct: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(80),

      isActive: Joi.boolean(),
    }),
    'body'
  ),

  async (req, res) => {
    const validPriorities = [
      'P1_CRITICAL',
      'P2_HIGH',
      'P3_MEDIUM',
      'P4_LOW',
    ];

    if (
      !validPriorities.includes(
        req.params.priority
      )
    ) {
      return ApiResponse.badRequest(res, {
        message: 'Invalid priority level',
      });
    }

    const configuration =
      await slaService.updateSLAConfiguration(
        req.params.priority,
        req.body
      );

    return ApiResponse.success(res, {
      message: 'SLA configuration updated',
      data: configuration,
    });
  }
);

/**
 * @swagger
 * /sla/tickets/{id}/status:
 *   get:
 *     summary: Get SLA status for a ticket
 *     tags: [SLA]
 */
router.get(
  '/tickets/:id/status',

  authorize(
    PERMISSIONS.TICKET_READ_OWN,
    PERMISSIONS.TICKET_READ_ALL
  ),

  async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: {
        id: req.params.id,
        deletedAt: null,
      },
    });

    if (!ticket) {
      return ApiResponse.notFound(res, {
        message: 'Ticket not found',
      });
    }

    const permissions =
      req.user?.role?.permissions?.map(
        rolePermission =>
          rolePermission.permission.name
      ) || [];

    assertCanReadTicket(
      ticket,
      req.user.id,
      permissions
    );

    const status =
      await slaService.getSLAStatus(ticket);

    return ApiResponse.success(res, {
      data: status,
    });
  }
);

/**
 * @swagger
 * /sla/report:
 *   get:
 *     summary: Get SLA compliance report
 *     tags: [SLA]
 */
router.get(
  '/report',

  authorize(PERMISSIONS.ANALYTICS_READ),

  async (req, res) => {
    const {
      from,
      to,
    } = req.query;

    const report =
      await slaService.getSLAReport(
        from,
        to
      );

    ApiResponse.success(res, {
      data: report,
    });
  }
);

/**
 * @swagger
 * /sla/check:
 *   post:
 *     summary: Trigger an SLA breach check
 *     tags: [SLA]
 */
router.post(
  '/check',

  authorize(PERMISSIONS.SYSTEM_SLA),

  async (req, res) => {
    const result =
      await slaService.checkSLABreaches();

    ApiResponse.success(res, {
      message: 'SLA check completed',
      data: result,
    });
  }
);

module.exports = router;