// src/modules/routing/routing.controller.js + routes
const express = require('express');
const Joi = require('joi');
const routingService = require('./routing.service');
const ApiResponse = require('../../shared/response');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { PERMISSIONS } = require('../../shared/constants');
const { validate } = require('../../middleware/index');

// ─── Controller handlers ──────────────────────────────────────────────────────

async function getRoutingRules(req, res) {
  const rules = await routingService.getRoutingRules(req.query);
  ApiResponse.success(res, { data: rules });
}

async function createRoutingRule(req, res) {
  const rule = await routingService.createRoutingRule(req.body);
  ApiResponse.created(res, { message: 'Routing rule created', data: rule });
}

async function updateRoutingRule(req, res) {
  const rule = await routingService.updateRoutingRule(req.params.id, req.body);
  ApiResponse.success(res, { message: 'Routing rule updated', data: rule });
}

async function deleteRoutingRule(req, res) {
  await routingService.deleteRoutingRule(req.params.id);
  ApiResponse.success(res, { message: 'Routing rule deleted', data: {} });
}

async function testRoutingRule(req, res) {
  const result = await routingService.testRoutingRule(req.params.id, req.body);
  ApiResponse.success(res, { data: result });
}

// ─── Validation schema ────────────────────────────────────────────────────────

const ruleSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).allow('', null),
  ruleType: Joi.string().valid('CATEGORY_BASED', 'PRIORITY_BASED', 'KEYWORD_BASED', 'DEPARTMENT_BASED', 'WORKLOAD_BASED').required(),
  priority: Joi.number().integer().min(0).max(1000).default(0),
  isActive: Joi.boolean().default(true),
  conditions: Joi.object().required(),
  assignTo: Joi.string().uuid().allow(null),
  departmentId: Joi.string().uuid().allow(null),
});

const patchSchema = ruleSchema.fork(
  ['name', 'ruleType', 'conditions'],
  s => s.optional()
);

// ─── Router ───────────────────────────────────────────────────────────────────

const router = express.Router();

router.use(authenticate);
router.use(authorize(PERMISSIONS.SYSTEM_ROUTING));

router.get('/', getRoutingRules);
router.post('/', validate(ruleSchema), createRoutingRule);
router.patch('/:id', validate(patchSchema), updateRoutingRule);
router.delete('/:id', deleteRoutingRule);
router.post('/:id/test', testRoutingRule);

module.exports = router;
