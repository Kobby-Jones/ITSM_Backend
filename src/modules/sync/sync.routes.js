// src/modules/sync/sync.routes.js
const express = require('express');
const router = express.Router();
const syncService = require('./sync.service');
const ApiResponse = require('../../shared/response');
const { authenticate } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/index');
const Joi = require('joi');

/**
 * @swagger
 * tags:
 *   name: Sync
 *   description: Offline-First Synchronization
 */

router.use(authenticate);

/**
 * @swagger
 * /sync/batch:
 *   post:
 *     summary: Submit a batch of offline operations for sync
 *     tags: [Sync]
 */
router.post('/batch',
  validate(Joi.object({
    items: Joi.array().items(Joi.object({
      entityType: Joi.string().valid('ticket', 'comment', 'asset').required(),
      entityId: Joi.string().allow(null),
      operation: Joi.string().valid('CREATE', 'UPDATE', 'DELETE', 'COMMENT').required(),
      payload: Joi.object().required(),
      offlineId: Joi.string().required(),
      clientVersion: Joi.string().allow(null),
    })).min(1).max(50).required(),
  })),
  async (req, res) => {
    const perms = req.user?.role?.permissions?.map(rp => rp.permission.name) || [];
    const results = await syncService.submitSyncBatch(req.body.items, req.user.id, perms);
    ApiResponse.success(res, { message: `Processed ${results.length} sync items`, data: results });
  }
);

/**
 * @swagger
 * /sync/queue:
 *   get:
 *     summary: Get user's sync queue
 *     tags: [Sync]
 */
router.get('/queue', async (req, res) => {
  const result = await syncService.getSyncQueue(req.user.id, req.query);
  ApiResponse.paginated(res, { data: result.items, total: result.total, page: result.page, limit: result.limit });
});

/**
 * @swagger
 * /sync/status:
 *   get:
 *     summary: Get sync status for current user
 *     tags: [Sync]
 */
router.get('/status', async (req, res) => {
  const status = await syncService.getSyncStatus(req.user.id);
  ApiResponse.success(res, { data: status });
});

/**
 * @swagger
 * /sync/process:
 *   post:
 *     summary: Process pending sync queue items
 *     tags: [Sync]
 */
router.post('/process', async (req, res) => {
  const perms = req.user?.role?.permissions?.map(rp => rp.permission.name) || [];
  const results = await syncService.processPendingQueue(req.user.id, perms);
  ApiResponse.success(res, { message: `Processed ${results.length} items`, data: results });
});

// ============================================================
// src/modules/search/search.routes.js
// ============================================================
const searchRouter = express.Router();
const { prisma } = require('../../config/database');
const searchApiResponse = ApiResponse;
const { authenticate: searchAuth } = require('../../middleware/auth.middleware');
const { getPagination } = require('../../utils/helpers');

searchRouter.use(searchAuth);

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Global full-text search
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [tickets, articles, assets, users, all] }
 */
searchRouter.get('/', async (req, res) => {
  const { q, type = 'all' } = req.query;
  const { page, limit, skip } = getPagination(req.query);

  if (!q || q.trim().length < 2) {
    return searchApiResponse.badRequest(res, { message: 'Search query must be at least 2 characters' });
  }

  const perms = req.user?.role?.permissions?.map(rp => rp.permission.name) || [];
  const canReadAll = perms.includes('ticket:read:all');
  const query = q.trim();
  const results = {};

  const searchPromises = [];

  if (type === 'all' || type === 'tickets') {
    const ticketWhere = {
      deletedAt: null,
      ...(!canReadAll ? { creatorId: req.user.id } : {}),
      OR: [
        { ticketNumber: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };
    searchPromises.push(
      prisma.ticket.findMany({
        where: ticketWhere,
        select: { id: true, ticketNumber: true, title: true, status: true, priority: true, createdAt: true },
        take: type === 'all' ? 5 : limit,
        skip: type === 'all' ? 0 : skip,
        orderBy: { createdAt: 'desc' },
      }).then(r => { results.tickets = r; })
    );
  }

  if (type === 'all' || type === 'articles') {
    searchPromises.push(
      prisma.knowledgeArticle.findMany({
        where: {
          deletedAt: null,
          status: 'PUBLISHED',
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
            { tags: { has: query } },
          ],
        },
        select: { id: true, title: true, summary: true, category: true, viewCount: true },
        take: type === 'all' ? 5 : limit,
        skip: type === 'all' ? 0 : skip,
      }).then(r => { results.articles = r; })
    );
  }

  if ((type === 'all' || type === 'assets') && canReadAll) {
    searchPromises.push(
      prisma.asset.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { assetTag: { contains: query, mode: 'insensitive' } },
            { serialNumber: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, assetTag: true, category: true, status: true },
        take: type === 'all' ? 5 : limit,
        skip: type === 'all' ? 0 : skip,
      }).then(r => { results.assets = r; })
    );
  }

  if ((type === 'all' || type === 'users') && canReadAll) {
    searchPromises.push(
      prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { employeeId: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, employeeId: true },
        take: type === 'all' ? 5 : limit,
        skip: type === 'all' ? 0 : skip,
      }).then(r => { results.users = r; })
    );
  }

  await Promise.all(searchPromises);
  searchApiResponse.success(res, { data: results });
});

module.exports = { syncRouter: router, searchRouter };
