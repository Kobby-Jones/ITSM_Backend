// src/modules/tickets/tickets.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('./tickets.controller');
const validators = require('./tickets.controller'); // validators embedded in same file
const Joi = require('joi');
const { validate } = require('../../middleware/index');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { upload, setUploadType } = require('../../middleware/upload.middleware');
const { PERMISSIONS } = require('../../shared/constants');

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
 *     summary: Get tickets (filtered by permission - own or all)
 *     tags: [Tickets]
 */
router.get('/', authorize(PERMISSIONS.TICKET_READ_OWN, PERMISSIONS.TICKET_READ_ALL), ctrl.getTickets);

/**
 * @swagger
 * /tickets:
 *   post:
 *     summary: Create a new ticket
 *     tags: [Tickets]
 */
router.post('/',
  authorize(PERMISSIONS.TICKET_CREATE),
  validate(Joi.object({
    title: Joi.string().min(5).max(200).trim().required(),
    description: Joi.string().min(10).max(5000).trim().required(),
    category: Joi.string().valid('NETWORK_CONNECTIVITY','HARDWARE_ISSUES','SOFTWARE_APPLICATION','ACCOUNT_ACCESS_IDENTITY','PRINTING_PROBLEMS','PRODUCTION_SYSTEMS').required(),
    priority: Joi.string().valid('P1_CRITICAL','P2_HIGH','P3_MEDIUM','P4_LOW').default('P3_MEDIUM'),
    tags: Joi.array().items(Joi.string().max(50)).max(10).default([]),
    departmentId: Joi.string().uuid().allow(null),
    offlineId: Joi.string().allow(null),
    impact: Joi.string().max(500).allow('', null),
    urgency: Joi.string().max(500).allow('', null),
  })),
  ctrl.createTicket
);

/**
 * @swagger
 * /tickets/{id}:
 *   get:
 *     summary: Get ticket by ID
 *     tags: [Tickets]
 */
router.get('/:id', authorize(PERMISSIONS.TICKET_READ_OWN, PERMISSIONS.TICKET_READ_ALL), ctrl.getTicketById);

/**
 * @swagger
 * /tickets/{id}:
 *   patch:
 *     summary: Update ticket
 *     tags: [Tickets]
 */
router.patch('/:id',
  authorize(PERMISSIONS.TICKET_UPDATE_OWN, PERMISSIONS.TICKET_UPDATE_ALL),
  validate(Joi.object({
    title: Joi.string().min(5).max(200).trim(),
    description: Joi.string().min(10).max(5000).trim(),
    priority: Joi.string().valid('P1_CRITICAL','P2_HIGH','P3_MEDIUM','P4_LOW'),
    category: Joi.string().valid('NETWORK_CONNECTIVITY','HARDWARE_ISSUES','SOFTWARE_APPLICATION','ACCOUNT_ACCESS_IDENTITY','PRINTING_PROBLEMS','PRODUCTION_SYSTEMS'),
    tags: Joi.array().items(Joi.string().max(50)).max(10),
    departmentId: Joi.string().uuid().allow(null),
    impact: Joi.string().max(500).allow('', null),
    urgency: Joi.string().max(500).allow('', null),
    isPublic: Joi.boolean(),
  })),
  ctrl.updateTicket
);

/**
 * @swagger
 * /tickets/{id}/assign:
 *   patch:
 *     summary: Assign ticket to technician
 *     tags: [Tickets]
 */
router.patch('/:id/assign',
  authorize(PERMISSIONS.TICKET_ASSIGN),
  validate(Joi.object({ assigneeId: Joi.string().uuid().allow(null).required() })),
  ctrl.assignTicket
);

/**
 * @swagger
 * /tickets/{id}/status:
 *   patch:
 *     summary: Change ticket status
 *     tags: [Tickets]
 */
router.patch('/:id/status',
  authorize(PERMISSIONS.TICKET_UPDATE_OWN, PERMISSIONS.TICKET_UPDATE_ALL, PERMISSIONS.TICKET_CLOSE),
  validate(Joi.object({
    status: Joi.string().valid('OPEN','ASSIGNED','IN_PROGRESS','PENDING','RESOLVED','CLOSED','ESCALATED').required(),
    note: Joi.string().max(1000).allow('', null),
  })),
  ctrl.changeStatus
);

/**
 * @swagger
 * /tickets/{id}/escalate:
 *   post:
 *     summary: Escalate ticket
 *     tags: [Tickets]
 */
router.post('/:id/escalate',
  authorize(PERMISSIONS.TICKET_ESCALATE),
  validate(Joi.object({ note: Joi.string().max(1000).allow('', null) })),
  ctrl.escalateTicket
);

/**
 * @swagger
 * /tickets/{id}/comments:
 *   post:
 *     summary: Add comment to ticket
 *     tags: [Tickets]
 */
router.post('/:id/comments',
  authorize(PERMISSIONS.TICKET_READ_OWN, PERMISSIONS.TICKET_READ_ALL),
  validate(Joi.object({
    content: Joi.string().min(1).max(5000).trim().required(),
    isInternal: Joi.boolean().default(false),
  })),
  ctrl.addComment
);

/**
 * @swagger
 * /tickets/{id}/comments/{commentId}:
 *   delete:
 *     summary: Delete comment
 *     tags: [Tickets]
 */
router.delete('/:id/comments/:commentId', ctrl.deleteComment);

/**
 * @swagger
 * /tickets/{id}/attachments:
 *   post:
 *     summary: Upload attachment
 *     tags: [Tickets]
 */
router.post('/:id/attachments',
  setUploadType('ticket'),
  upload.single('file'),
  ctrl.uploadAttachment
);

/**
 * @swagger
 * /tickets/{id}/history:
 *   get:
 *     summary: Get ticket change history
 *     tags: [Tickets]
 */
router.get('/:id/history',
  authorize(PERMISSIONS.TICKET_READ_ALL),
  ctrl.getTicketHistory
);

module.exports = router;
