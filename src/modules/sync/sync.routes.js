// src/modules/sync/sync.routes.js
const express = require('express');
const Joi = require('joi');

const syncRouter = express.Router();
const searchRouter = express.Router();

const syncService = require('./sync.service');
const ApiResponse = require('../../shared/response');

const {
  authenticate,
} = require('../../middleware/auth.middleware');

const {
  validate,
} = require('../../middleware/index');

const {
  prisma,
} = require('../../config/database');

const {
  getPagination,
} = require('../../utils/helpers');

const {
  PERMISSIONS,
} = require('../../shared/constants');

// ============================================================
// PERMISSION HELPERS
// ============================================================

function getUserPermissions(req) {
  return req.user?.role?.permissions?.map(
    rolePermission =>
      rolePermission.permission.name
  ) || [];
}

// ============================================================
// OFFLINE SYNCHRONIZATION ROUTES
// ============================================================

syncRouter.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Sync
 *   description: Offline-first synchronization
 */

/**
 * @swagger
 * /sync/batch:
 *   post:
 *     summary: Submit offline operations for synchronization
 *     tags: [Sync]
 */
syncRouter.post(
  '/batch',

  validate(
    Joi.object({
      items: Joi.array()
        .items(
          Joi.object({
            /*
             * The current synchronization service implements ticket
             * operations. Unsupported entity types must not be advertised.
             */
            entityType: Joi.string()
              .valid('ticket')
              .required(),

            entityId: Joi.string()
              .allow('', null),

            operation: Joi.string()
              .valid(
                'CREATE',
                'UPDATE',
                'COMMENT'
              )
              .required(),

            payload: Joi.object()
              .required(),

            offlineId: Joi.string()
              .trim()
              .required(),

            clientVersion: Joi.date()
              .iso()
              .allow(null),
          })
        )
        .min(1)
        .max(50)
        .required(),
    })
  ),

  async (req, res) => {
    const permissions =
      getUserPermissions(req);

    const results =
      await syncService.submitSyncBatch(
        req.body.items,
        req.user.id,
        permissions
      );

    ApiResponse.success(res, {
      message:
        `Processed ${results.length} sync items`,

      data: results,
    });
  }
);

/**
 * @swagger
 * /sync/queue:
 *   get:
 *     summary: Get the authenticated user's synchronization queue
 *     tags: [Sync]
 */
syncRouter.get(
  '/queue',
  async (req, res) => {
    const result =
      await syncService.getSyncQueue(
        req.user.id,
        req.query
      );

    ApiResponse.paginated(res, {
      data: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  }
);

/**
 * @swagger
 * /sync/status:
 *   get:
 *     summary: Get synchronization status
 *     tags: [Sync]
 */
syncRouter.get(
  '/status',
  async (req, res) => {
    const status =
      await syncService.getSyncStatus(
        req.user.id
      );

    ApiResponse.success(res, {
      data: status,
    });
  }
);

/**
 * @swagger
 * /sync/process:
 *   post:
 *     summary: Process pending synchronization operations
 *     tags: [Sync]
 */
syncRouter.post(
  '/process',
  async (req, res) => {
    const permissions =
      getUserPermissions(req);

    const results =
      await syncService.processPendingQueue(
        req.user.id,
        permissions
      );

    ApiResponse.success(res, {
      message:
        `Processed ${results.length} items`,

      data: results,
    });
  }
);

// ============================================================
// GLOBAL SEARCH ROUTES
// ============================================================

searchRouter.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Global authorized search
 */

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Search tickets, articles, assets and users
 *     tags: [Search]
 */
searchRouter.get(
  '/',
  async (req, res) => {
    const {
      q,
      type = 'all',
    } = req.query;

    const allowedTypes = [
      'tickets',
      'articles',
      'assets',
      'users',
      'all',
    ];

    if (!allowedTypes.includes(type)) {
      return ApiResponse.badRequest(res, {
        message:
          'Invalid search type. Use tickets, articles, assets, users or all',
      });
    }

    if (
      !q
      || typeof q !== 'string'
      || q.trim().length < 2
    ) {
      return ApiResponse.badRequest(res, {
        message:
          'Search query must be at least 2 characters',
      });
    }

    const {
      page,
      limit,
      skip,
    } = getPagination(req.query);

    const permissions =
      getUserPermissions(req);

    const canReadAllTickets =
      permissions.includes(
        PERMISSIONS.TICKET_READ_ALL
      );

    const canReadAssets =
      permissions.includes(
        PERMISSIONS.ASSET_READ
      );

    const canReadUsers =
      permissions.includes(
        PERMISSIONS.USER_READ
      );

    const query = q.trim();
    const results = {};
    const searchPromises = [];

    // --------------------------------------------------------
    // TICKET SEARCH
    // --------------------------------------------------------

    if (
      type === 'all'
      || type === 'tickets'
    ) {
      const ticketWhere = {
        deletedAt: null,

        ...(
          !canReadAllTickets
            ? {
                creatorId: req.user.id,
              }
            : {}
        ),

        OR: [
          {
            ticketNumber: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            title: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      };

      searchPromises.push(
        prisma.ticket.findMany({
          where: ticketWhere,

          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
          },

          take:
            type === 'all'
              ? 5
              : limit,

          skip:
            type === 'all'
              ? 0
              : skip,

          orderBy: {
            createdAt: 'desc',
          },
        }).then(ticketResults => {
          results.tickets =
            ticketResults;
        })
      );
    }

    // --------------------------------------------------------
    // KNOWLEDGE-BASE SEARCH
    // --------------------------------------------------------

    if (
      type === 'all'
      || type === 'articles'
    ) {
      searchPromises.push(
        prisma.knowledgeArticle.findMany({
          where: {
            deletedAt: null,
            status: 'PUBLISHED',

            OR: [
              {
                title: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                content: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                tags: {
                  has: query,
                },
              },
            ],
          },

          select: {
            id: true,
            title: true,
            summary: true,
            category: true,
            viewCount: true,
          },

          take:
            type === 'all'
              ? 5
              : limit,

          skip:
            type === 'all'
              ? 0
              : skip,
        }).then(articleResults => {
          results.articles =
            articleResults;
        })
      );
    }

    // --------------------------------------------------------
    // ASSET SEARCH
    // --------------------------------------------------------

    if (
      (
        type === 'all'
        || type === 'assets'
      )
      && canReadAssets
    ) {
      searchPromises.push(
        prisma.asset.findMany({
          where: {
            deletedAt: null,

            OR: [
              {
                name: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                assetTag: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                serialNumber: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          },

          select: {
            id: true,
            name: true,
            assetTag: true,
            category: true,
            status: true,
          },

          take:
            type === 'all'
              ? 5
              : limit,

          skip:
            type === 'all'
              ? 0
              : skip,
        }).then(assetResults => {
          results.assets =
            assetResults;
        })
      );
    }

    if (
      type === 'assets'
      && !canReadAssets
    ) {
      return ApiResponse.forbidden(res, {
        message:
          'You do not have permission to search assets',
      });
    }

    // --------------------------------------------------------
    // USER SEARCH
    // --------------------------------------------------------

    if (
      (
        type === 'all'
        || type === 'users'
      )
      && canReadUsers
    ) {
      searchPromises.push(
        prisma.user.findMany({
          where: {
            deletedAt: null,

            OR: [
              {
                firstName: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                employeeId: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          },

          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },

          take:
            type === 'all'
              ? 5
              : limit,

          skip:
            type === 'all'
              ? 0
              : skip,
        }).then(userResults => {
          results.users =
            userResults;
        })
      );
    }

    if (
      type === 'users'
      && !canReadUsers
    ) {
      return ApiResponse.forbidden(res, {
        message:
          'You do not have permission to search users',
      });
    }

    await Promise.all(searchPromises);

    return ApiResponse.success(res, {
      data: results,
    });
  }
);

module.exports = {
  syncRouter,
  searchRouter,
};