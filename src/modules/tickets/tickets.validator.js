// src/modules/tickets/tickets.validator.js
const Joi = require('joi');

const createTicket = Joi.object({
  title: Joi.string().min(5).max(200).trim().required(),
  description: Joi.string().min(10).max(5000).trim().required(),
  category: Joi.string().valid(
    'NETWORK_CONNECTIVITY','HARDWARE_ISSUES','SOFTWARE_APPLICATION',
    'ACCOUNT_ACCESS_IDENTITY','PRINTING_PROBLEMS','PRODUCTION_SYSTEMS'
  ).required(),
  priority: Joi.string().valid('P1_CRITICAL','P2_HIGH','P3_MEDIUM','P4_LOW').default('P3_MEDIUM'),
  tags: Joi.array().items(Joi.string().max(50)).max(10).default([]),
  departmentId: Joi.string().uuid().allow(null),
  offlineId: Joi.string().allow(null),
  impact: Joi.string().max(500).allow('', null),
  urgency: Joi.string().max(500).allow('', null),
});

const updateTicket = Joi.object({
  title: Joi.string().min(5).max(200).trim(),
  description: Joi.string().min(10).max(5000).trim(),
  priority: Joi.string().valid('P1_CRITICAL','P2_HIGH','P3_MEDIUM','P4_LOW'),
  category: Joi.string().valid(
    'NETWORK_CONNECTIVITY','HARDWARE_ISSUES','SOFTWARE_APPLICATION',
    'ACCOUNT_ACCESS_IDENTITY','PRINTING_PROBLEMS','PRODUCTION_SYSTEMS'
  ),
  tags: Joi.array().items(Joi.string().max(50)).max(10),
  departmentId: Joi.string().uuid().allow(null),
  impact: Joi.string().max(500).allow('', null),
  urgency: Joi.string().max(500).allow('', null),
  isPublic: Joi.boolean(),
});

const assignTicket = Joi.object({
  assigneeId: Joi.string().uuid().allow(null).required(),
});

const changeStatus = Joi.object({
  status: Joi.string().valid('OPEN','ASSIGNED','IN_PROGRESS','PENDING','RESOLVED','CLOSED','ESCALATED').required(),
  note: Joi.string().max(1000).allow('', null),
});

const addComment = Joi.object({
  content: Joi.string().min(1).max(5000).trim().required(),
  isInternal: Joi.boolean().default(false),
});

module.exports = { createTicket, updateTicket, assignTicket, changeStatus, addComment };
