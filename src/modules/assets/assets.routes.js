// src/modules/assets/assets.routes.js
const express = require('express');
const router = express.Router();
const assetsService = require('./assets.service');
const ApiResponse = require('../../shared/response');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/index');
const { PERMISSIONS } = require('../../shared/constants');
const Joi = require('joi');

/**
 * @swagger
 * tags:
 *   name: Assets
 *   description: IT Asset Management
 */

router.use(authenticate);

const assetSchema = Joi.object({
  name: Joi.string().min(2).max(200).trim().required(),
  description: Joi.string().max(1000).allow('', null),
  category: Joi.string().valid('LAPTOP','DESKTOP','SERVER','PRINTER','NETWORK_DEVICE','MOBILE_DEVICE','PERIPHERAL','SOFTWARE_LICENSE','OTHER').required(),
  status: Joi.string().valid('ACTIVE','INACTIVE','UNDER_MAINTENANCE','DISPOSED','LOST').default('ACTIVE'),
  make: Joi.string().max(100).allow('', null),
  model: Joi.string().max(100).allow('', null),
  serialNumber: Joi.string().max(100).allow('', null),
  assetTag: Joi.string().max(100).allow('', null),
  purchaseDate: Joi.date().allow(null),
  purchasePrice: Joi.number().precision(2).min(0).allow(null),
  warrantyExpiry: Joi.date().allow(null),
  location: Joi.string().max(200).allow('', null),
  departmentId: Joi.string().uuid().allow(null),
  specifications: Joi.object().allow(null),
  notes: Joi.string().max(2000).allow('', null),
});

router.get('/', authorize(PERMISSIONS.ASSET_READ), async (req, res) => {
  const result = await assetsService.getAssets(req.query);
  ApiResponse.paginated(res, { data: result.assets, total: result.total, page: result.page, limit: result.limit });
});

router.get('/stats', authorize(PERMISSIONS.ASSET_READ), async (req, res) => {
  const stats = await assetsService.getAssetStats();
  ApiResponse.success(res, { data: stats });
});

router.get('/:id', authorize(PERMISSIONS.ASSET_READ), async (req, res) => {
  const asset = await assetsService.getAssetById(req.params.id);
  ApiResponse.success(res, { data: asset });
});

router.get('/:id/history', authorize(PERMISSIONS.ASSET_READ), async (req, res) => {
  const history = await assetsService.getAssetAssignmentHistory(req.params.id);
  ApiResponse.success(res, { data: history });
});

router.post('/', authorize(PERMISSIONS.ASSET_CREATE), validate(assetSchema), async (req, res) => {
  const asset = await assetsService.createAsset(req.body);
  ApiResponse.created(res, { message: 'Asset created', data: asset });
});

router.patch('/:id', authorize(PERMISSIONS.ASSET_UPDATE),
  validate(assetSchema.fork(Object.keys(assetSchema.describe().keys), s => s.optional())),
  async (req, res) => {
    const asset = await assetsService.updateAsset(req.params.id, req.body);
    ApiResponse.success(res, { message: 'Asset updated', data: asset });
  }
);

router.delete('/:id', authorize(PERMISSIONS.ASSET_DELETE), async (req, res) => {
  await assetsService.deleteAsset(req.params.id);
  ApiResponse.success(res, { message: 'Asset deleted', data: {} });
});

router.post('/:id/assign',
  authorize(PERMISSIONS.ASSET_ASSIGN),
  validate(Joi.object({
    userId: Joi.string().uuid().required(),
    notes: Joi.string().max(500).allow('', null),
  })),
  async (req, res) => {
    const result = await assetsService.assignAsset(req.params.id, req.body.userId, req.user.id, req.body.notes);
    ApiResponse.success(res, { message: 'Asset assigned', data: result });
  }
);

router.post('/:id/return',
  authorize(PERMISSIONS.ASSET_ASSIGN),
  validate(Joi.object({ notes: Joi.string().max(500).allow('', null) })),
  async (req, res) => {
    const result = await assetsService.returnAsset(req.params.id, req.body.notes);
    ApiResponse.success(res, { message: 'Asset returned', data: result });
  }
);

module.exports = router;
