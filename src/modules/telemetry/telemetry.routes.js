// src/modules/telemetry/telemetry.routes.js
const express = require('express');
const router = express.Router();
const telemetryService = require('./telemetry.service');
const ApiResponse = require('../../shared/response');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/index');
const { PERMISSIONS } = require('../../shared/constants');
const Joi = require('joi');

/**
 * @swagger
 * tags:
 *   name: Telemetry
 *   description: Device Telemetry Collection
 */

router.use(authenticate);

const telemetrySchema = Joi.object({
  deviceId: Joi.string().max(200).allow(null),
  platform: Joi.string().valid('android', 'windows', 'linux', 'ios', 'web').allow(null),
  deviceModel: Joi.string().max(200).allow(null),
  osVersion: Joi.string().max(100).allow(null),
  appVersion: Joi.string().max(50).allow(null),
  ramTotal: Joi.number().integer().positive().allow(null),
  ramAvailable: Joi.number().integer().min(0).allow(null),
  cpuUsage: Joi.number().min(0).max(100).allow(null),
  batteryLevel: Joi.number().min(0).max(100).allow(null),
  storageTotal: Joi.number().integer().positive().allow(null),
  storageAvailable: Joi.number().integer().min(0).allow(null),
  networkStatus: Joi.string().valid('online', 'offline', 'limited').allow(null),
  networkType: Joi.string().valid('wifi', 'cellular', 'ethernet', 'unknown').allow(null),
  crashLogs: Joi.object().allow(null),
  errorLogs: Joi.array().items(Joi.object()).allow(null),
  metadata: Joi.object().allow(null),
  recordedAt: Joi.date().iso().allow(null),
});

/**
 * @swagger
 * /telemetry:
 *   post:
 *     summary: Ingest device telemetry data
 *     tags: [Telemetry]
 */
router.post('/', validate(telemetrySchema), async (req, res) => {
  const result = await telemetryService.ingestTelemetry(req.body, req.user.id);
  ApiResponse.created(res, { message: 'Telemetry recorded', data: result });
});

/**
 * @swagger
 * /telemetry/devices:
 *   get:
 *     summary: Get user's registered devices
 *     tags: [Telemetry]
 */
router.get('/devices', async (req, res) => {
  const devices = await telemetryService.getUserDevices(req.user.id);
  ApiResponse.success(res, { data: devices });
});

/**
 * @swagger
 * /telemetry/analytics:
 *   get:
 *     summary: Get telemetry analytics (admin)
 *     tags: [Telemetry]
 */
router.get('/analytics', authorize(PERMISSIONS.ANALYTICS_READ), async (req, res) => {
  const analytics = await telemetryService.getTelemetryAnalytics(req.query);
  ApiResponse.success(res, { data: analytics });
});

/**
 * @swagger
 * /telemetry/devices/{deviceId}:
 *   get:
 *     summary: Get device health status
 *     tags: [Telemetry]
 */
router.get('/devices/:deviceId', async (req, res) => {
  const health = await telemetryService.getDeviceHealth(req.params.deviceId);
  if (!health) return ApiResponse.notFound(res, { message: 'Device not found' });
  ApiResponse.success(res, { data: health });
});

/**
 * @swagger
 * /telemetry/devices/{deviceId}/logs:
 *   get:
 *     summary: Get telemetry logs for a device
 *     tags: [Telemetry]
 */
router.get('/devices/:deviceId/logs', async (req, res) => {
  const device = await require('../../config/database').prisma.device.findUnique({
    where: { deviceId: req.params.deviceId },
  });
  if (!device) return ApiResponse.notFound(res, { message: 'Device not found' });

  const result = await telemetryService.getDeviceTelemetry(device.id, req.query);
  ApiResponse.paginated(res, { data: result.logs, total: result.total, page: result.page, limit: result.limit });
});

module.exports = router;
