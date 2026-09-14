// src/modules/tickets/tickets.routes.js
const express = require('express');
const Joi = require('joi');

const router = express.Router();
const controller = require('./tickets.controller');

const {
  validate,
  auditLog,
} = require('../../middleware/index');

const {
  authenticate,
  authorize,
} = require('../../middleware/auth.middleware');

const {
  upload,
  setUploadType,
} = require('../../middleware/upload.middleware');

const {
  requireTicketAccess,
} = require('../../middleware/ticket-access.middleware');

const {
  PERMISSIONS,
} = require('../../shared/constants');

/**
 * @swagger
 * tags:
 *   name: Tickets
 *   description: IT Service Ticket Management
 */

router.use(authenticate);

/**
 * @swagger
 * /tickets:
 *   get:
 *     summary: Get tickets available to the authenticated user
 *     tags: [Tickets]
 */
router.get(
  '/',
  authorize(
    PERMISSIONS.TICKET_READ_OWN,
    PERMISSIONS.TICKET_READ_ALL
  ),
  controller.getTickets
);

/**
 * @swagger
 * /tickets:
 *   post:
 *     summary: Create a new ticket
 *     tags: [Tickets]
 */
router.post(
  '/',

  authorize(PERMISSIONS.TICKET_CREATE),
  auditLog('CREATE', 'ticket'),

  validate(
    Joi.object({
      title: Joi.string()
        .min(5)
        .max(200)
        .trim()
        .required(),

      description: Joi.string()
        .min(10)
        .max(5000)
        .trim()
        .required(),

      category: Joi.string()
        .valid(
          'NETWORK_CONNECTIVITY',
          'HARDWARE_ISSUES',
          'SOFTWARE_APPLICATION',
          'ACCOUNT_ACCESS_IDENTITY',
          'PRINTING_PROBLEMS',
          'PRODUCTION_SYSTEMS'
        )
        .required(),

      priority: Joi.string()
        .valid(
          'P1_CRITICAL',
          'P2_HIGH',
          'P3_MEDIUM',
          'P4_LOW'
        )
        .default('P3_MEDIUM'),

      tags: Joi.array()
        .items(
          Joi.string()
            .trim()
            .max(50)
        )
        .max(10)
        .default([]),

      departmentId: Joi.string()
        .uuid()
        .allow(null),

      offlineId: Joi.string()
        .trim()
        .allow('', null),

      impact: Joi.string()
        .max(500)
        .allow('', null),

      urgency: Joi.string()
        .max(500)
        .allow('', null),

      // Optional device snapshot captured by the Flutter client at the
      // moment the ticket is created. It is ingested into telemetry_logs by
      // tickets.service.js and linked back to this ticket in metadata.
      telemetry: Joi.object({
        deviceId: Joi.string().max(200).allow(null),
        platform: Joi.string()
          .valid('android', 'windows', 'linux', 'ios', 'macos', 'web')
          .allow(null),
        deviceModel: Joi.string().max(200).allow(null),
        osVersion: Joi.string().max(100).allow(null),
        appVersion: Joi.string().max(50).allow(null),
        ramTotal: Joi.number().integer().positive().allow(null),
        ramAvailable: Joi.number().integer().min(0).allow(null),
        cpuUsage: Joi.number().min(0).max(100).allow(null),
        batteryLevel: Joi.number().min(0).max(100).allow(null),
        storageTotal: Joi.number().integer().positive().allow(null),
        storageAvailable: Joi.number().integer().min(0).allow(null),
        networkStatus: Joi.string()
          .valid('online', 'offline', 'limited')
          .allow(null),
        networkType: Joi.string()
          .valid('wifi', 'cellular', 'ethernet', 'unknown')
          .allow(null),
        crashLogs: Joi.object().allow(null),
        errorLogs: Joi.array().items(Joi.object()).allow(null),
        metadata: Joi.object().allow(null),
        recordedAt: Joi.date().iso().allow(null),
      }).allow(null),
    })
  ),

  controller.createTicket
);

/**
 * @swagger
 * /tickets/{id}:
 *   get:
 *     summary: Get a ticket by ID
 *     tags: [Tickets]
 */
router.get(
  '/:id',

  authorize(
    PERMISSIONS.TICKET_READ_OWN,
    PERMISSIONS.TICKET_READ_ALL
  ),

  controller.getTicketById
);

/**
 * @swagger
 * /tickets/{id}:
 *   patch:
 *     summary: Update a ticket
 *     tags: [Tickets]
 */
router.patch(
  '/:id',

  authorize(
    PERMISSIONS.TICKET_UPDATE_OWN,
    PERMISSIONS.TICKET_UPDATE_ALL
  ),
  auditLog('UPDATE', 'ticket'),

  validate(
    Joi.object({
      title: Joi.string()
        .min(5)
        .max(200)
        .trim(),

      description: Joi.string()
        .min(10)
        .max(5000)
        .trim(),

      priority: Joi.string().valid(
        'P1_CRITICAL',
        'P2_HIGH',
        'P3_MEDIUM',
        'P4_LOW'
      ),

      category: Joi.string().valid(
        'NETWORK_CONNECTIVITY',
        'HARDWARE_ISSUES',
        'SOFTWARE_APPLICATION',
        'ACCOUNT_ACCESS_IDENTITY',
        'PRINTING_PROBLEMS',
        'PRODUCTION_SYSTEMS'
      ),

      tags: Joi.array()
        .items(
          Joi.string()
            .trim()
            .max(50)
        )
        .max(10),

      departmentId: Joi.string()
        .uuid()
        .allow(null),

      impact: Joi.string()
        .max(500)
        .allow('', null),

      urgency: Joi.string()
        .max(500)
        .allow('', null),

      isPublic: Joi.boolean(),
    }).min(1)
  ),

  controller.updateTicket
);

/**
 * @swagger
 * /tickets/{id}/assign:
 *   patch:
 *     summary: Assign a ticket to a technician
 *     tags: [Tickets]
 */
router.patch(
  '/:id/assign',

  authorize(PERMISSIONS.TICKET_ASSIGN),

  validate(
    Joi.object({
      assigneeId: Joi.string()
        .uuid()
        .allow(null)
        .required(),
    })
  ),

  controller.assignTicket
);

/**
 * @swagger
 * /tickets/{id}/status:
 *   patch:
 *     summary: Change ticket status
 *     tags: [Tickets]
 */
router.patch(
  '/:id/status',

  authorize(
    PERMISSIONS.TICKET_UPDATE_OWN,
    PERMISSIONS.TICKET_UPDATE_ALL,
    PERMISSIONS.TICKET_CLOSE
  ),

  validate(
    Joi.object({
      status: Joi.string()
        .valid(
          'OPEN',
          'ASSIGNED',
          'IN_PROGRESS',
          'PENDING',
          'RESOLVED',
          'CLOSED',
          'ESCALATED'
        )
        .required(),

      note: Joi.string()
        .max(1000)
        .allow('', null),
    })
  ),

  controller.changeStatus
);

/**
 * @swagger
 * /tickets/{id}/escalate:
 *   post:
 *     summary: Escalate a ticket
 *     tags: [Tickets]
 */
router.post(
  '/:id/escalate',

  authorize(PERMISSIONS.TICKET_ESCALATE),

  validate(
    Joi.object({
      note: Joi.string()
        .max(1000)
        .allow('', null),
    })
  ),

  controller.escalateTicket
);

/**
 * @swagger
 * /tickets/{id}/comments:
 *   post:
 *     summary: Add a comment to a ticket
 *     tags: [Tickets]
 */
router.post(
  '/:id/comments',

  authorize(
    PERMISSIONS.TICKET_READ_OWN,
    PERMISSIONS.TICKET_READ_ALL
  ),

  validate(
    Joi.object({
      content: Joi.string()
        .min(1)
        .max(5000)
        .trim()
        .required(),

      isInternal: Joi.boolean()
        .default(false),
    })
  ),

  controller.addComment
);

/**
 * @swagger
 * /tickets/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete a ticket comment
 *     tags: [Tickets]
 */
router.delete(
  '/:id/comments/:commentId',

  authorize(
    PERMISSIONS.TICKET_READ_OWN,
    PERMISSIONS.TICKET_READ_ALL
  ),

  controller.deleteComment
);

/**
 * @swagger
 * /tickets/{id}/attachments:
 *   post:
 *     summary: Upload a ticket attachment
 *     tags: [Tickets]
 */
router.post(
  '/:id/attachments',

  authorize(
    PERMISSIONS.TICKET_UPDATE_OWN,
    PERMISSIONS.TICKET_UPDATE_ALL
  ),

  // Authorize before Multer writes anything to disk.
  requireTicketAccess('update'),

  setUploadType('ticket'),
  upload.single('file'),
  controller.uploadAttachment
);

/**
 * @swagger
 * /tickets/{id}/attachments/{attachmentId}/download:
 *   get:
 *     summary: Download an authorized ticket attachment
 *     tags: [Tickets]
 */
router.get(
  '/:id/attachments/:attachmentId/download',

  authorize(
    PERMISSIONS.TICKET_READ_OWN,
    PERMISSIONS.TICKET_READ_ALL
  ),

  controller.downloadAttachment
);

/**
 * @swagger
 * /tickets/{id}/history:
 *   get:
 *     summary: Get ticket change history
 *     tags: [Tickets]
 */
router.get(
  '/:id/history',

  authorize(
    PERMISSIONS.TICKET_READ_OWN,
    PERMISSIONS.TICKET_READ_ALL
  ),

  controller.getTicketHistory
);

module.exports = router;