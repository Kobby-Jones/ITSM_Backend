const express = require('express');
const Joi = require('joi');

const assetsService = require('./assets.service');
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

const router = express.Router();

const ASSET_CATEGORIES = [
  'LAPTOP',
  'DESKTOP',
  'SERVER',
  'PRINTER',
  'NETWORK_DEVICE',
  'MOBILE_DEVICE',
  'PERIPHERAL',
  'SOFTWARE_LICENSE',
  'OTHER',
];

const ASSET_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'UNDER_MAINTENANCE',
  'DISPOSED',
  'LOST',
];

const assetIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

const assetFields = {
  name: Joi.string().trim().min(2).max(200),
  description: Joi.string().trim().max(1000).allow('', null),
  category: Joi.string().valid(...ASSET_CATEGORIES),
  status: Joi.string().valid(...ASSET_STATUSES),
  make: Joi.string().trim().max(100).allow('', null),
  model: Joi.string().trim().max(100).allow('', null),
  serialNumber: Joi.string().trim().max(100).allow('', null),
  assetTag: Joi.string().trim().max(100).allow('', null),
  purchaseDate: Joi.date().iso().allow(null),
  purchasePrice: Joi.number().precision(2).min(0).allow(null),
  warrantyExpiry: Joi.date().iso().allow(null),
  location: Joi.string().trim().max(200).allow('', null),
  departmentId: Joi.string().uuid().allow(null),
  specifications: Joi.object().allow(null),
  notes: Joi.string().trim().max(2000).allow('', null),
};

const createAssetSchema = Joi.object({
  ...assetFields,
  name: assetFields.name.required(),
  category: assetFields.category.required(),
  status: Joi.string()
    .valid(
      'INACTIVE',
      'UNDER_MAINTENANCE',
      'DISPOSED',
      'LOST'
    )
    .default('INACTIVE'),
});

const updateAssetSchema = Joi.object({
  ...assetFields,
}).min(1);

const listAssetsSchema = Joi.object({
  page: Joi.number().integer().min(1),

  // getPagination safely clamps this to the global maximum of 100.
  limit: Joi.number().integer().min(1),

  search: Joi.string().trim().max(200),
  status: Joi.string().valid(...ASSET_STATUSES),
  category: Joi.string().valid(...ASSET_CATEGORIES),
  departmentId: Joi.string().uuid(),
  warrantyExpiring: Joi.boolean(),

  sortBy: Joi.string().valid(
    'name',
    'assetTag',
    'createdAt',
    'category',
    'status',
    'warrantyExpiry'
  ),

  sortOrder: Joi.string().valid('asc', 'desc'),
});

const assignAssetSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  notes: Joi.string().trim().max(500).allow('', null),
});

const returnAssetSchema = Joi.object({
  notes: Joi.string().trim().max(500).allow('', null),
});

router.use(authenticate);

router.get(
  '/',
  authorize(PERMISSIONS.ASSET_READ),
  validate(listAssetsSchema, 'query'),
  async (req, res) => {
    const result = await assetsService.getAssets(req.query);

    return ApiResponse.paginated(res, {
      data: result.assets,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  }
);

router.get(
  '/stats',
  authorize(PERMISSIONS.ASSET_READ),
  async (req, res) => {
    const stats = await assetsService.getAssetStats();

    return ApiResponse.success(res, {
      data: stats,
    });
  }
);

router.get(
  '/:id',
  authorize(PERMISSIONS.ASSET_READ),
  validate(assetIdSchema, 'params'),
  async (req, res) => {
    const asset = await assetsService.getAssetById(req.params.id);

    return ApiResponse.success(res, {
      data: asset,
    });
  }
);

router.get(
  '/:id/history',
  authorize(PERMISSIONS.ASSET_READ),
  validate(assetIdSchema, 'params'),
  async (req, res) => {
    const history = await assetsService.getAssetAssignmentHistory(
      req.params.id
    );

    return ApiResponse.success(res, {
      data: history,
    });
  }
);

router.post(
  '/',
  authorize(PERMISSIONS.ASSET_CREATE),
  validate(createAssetSchema),
  async (req, res) => {
    const asset = await assetsService.createAsset(req.body);

    return ApiResponse.created(res, {
      message: 'Asset created',
      data: asset,
    });
  }
);

router.patch(
  '/:id',
  authorize(PERMISSIONS.ASSET_UPDATE),
  validate(assetIdSchema, 'params'),
  validate(updateAssetSchema),
  async (req, res) => {
    const asset = await assetsService.updateAsset(
      req.params.id,
      req.body
    );

    return ApiResponse.success(res, {
      message: 'Asset updated',
      data: asset,
    });
  }
);

router.delete(
  '/:id',
  authorize(PERMISSIONS.ASSET_DELETE),
  validate(assetIdSchema, 'params'),
  async (req, res) => {
    await assetsService.deleteAsset(req.params.id);

    return ApiResponse.success(res, {
      message: 'Asset deleted',
      data: {},
    });
  }
);

router.post(
  '/:id/assign',
  authorize(PERMISSIONS.ASSET_ASSIGN),
  validate(assetIdSchema, 'params'),
  validate(assignAssetSchema),
  async (req, res) => {
    const result = await assetsService.assignAsset(
      req.params.id,
      req.body.userId,
      req.user.id,
      req.body.notes
    );

    return ApiResponse.success(res, {
      message: 'Asset assigned',
      data: result,
    });
  }
);

router.post(
  '/:id/return',
  authorize(PERMISSIONS.ASSET_ASSIGN),
  validate(assetIdSchema, 'params'),
  validate(returnAssetSchema),
  async (req, res) => {
    const result = await assetsService.returnAsset(
      req.params.id,
      req.body.notes
    );

    return ApiResponse.success(res, {
      message: 'Asset returned',
      data: result,
    });
  }
);

module.exports = router;