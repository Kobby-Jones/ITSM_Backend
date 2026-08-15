// src/modules/knowledge-base/kb.routes.js
const express = require('express');
const Joi = require('joi');

const kbService = require('./kb.service');
const ApiResponse = require('../../shared/response');

const {
  authenticate,
  optionalAuth,
  authorize,
} = require('../../middleware/auth.middleware');

const {
  validate,
} = require('../../middleware/index');

const {
  PERMISSIONS,
} = require('../../shared/constants');

const router = express.Router();

const articleIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

const articleFields = {
  title: Joi.string()
    .min(5)
    .max(200)
    .trim(),

  content: Joi.string()
    .min(20)
    .max(100000),

  summary: Joi.string()
    .max(500)
    .allow('', null),

  status: Joi.string().valid(
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
  ),

  category: Joi.string()
    .min(2)
    .max(100)
    .trim(),

  tags: Joi.array()
    .items(
      Joi.string()
        .trim()
        .min(1)
        .max(50)
    )
    .max(20),

  isPublic: Joi.boolean(),
};

const createArticleSchema = Joi.object({
  ...articleFields,

  title:
    articleFields.title.required(),

  content:
    articleFields.content.required(),

  category:
    articleFields.category.required(),

  status:
    articleFields.status.default('DRAFT'),

  tags:
    articleFields.tags.default([]),

  isPublic:
    articleFields.isPublic.default(true),
});

const updateArticleSchema = Joi.object({
  ...articleFields,
}).min(1);

const listArticlesSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100),

  search: Joi.string()
    .trim()
    .max(200),

  status: Joi.string().valid(
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
  ),

  category: Joi.string()
    .trim()
    .max(100),

  tags: Joi.alternatives().try(
    Joi.string()
      .trim()
      .max(50),

    Joi.array()
      .items(
        Joi.string()
          .trim()
          .max(50)
      )
      .max(20)
  ),

  sortBy: Joi.string().valid(
    'title',
    'viewCount',
    'createdAt',
    'updatedAt'
  ),

  sortOrder: Joi.string().valid(
    'asc',
    'desc'
  ),
});

const ratingSchema = Joi.object({
  rating: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .required(),

  feedback: Joi.string()
    .trim()
    .max(500)
    .allow('', null),
});

const linkTicketSchema = Joi.object({
  ticketId: Joi.string()
    .uuid()
    .required(),
});

function getUserPermissions(req) {
  return (
    req.user?.role?.permissions?.map(
      rolePermission =>
        rolePermission.permission.name
    )
    || []
  );
}

router.get(
  '/',
  optionalAuth,
  validate(listArticlesSchema, 'query'),

  async (req, res) => {
    const result =
      await kbService.getArticles(
        req.query,
        req.user?.id,
        getUserPermissions(req)
      );

    return ApiResponse.paginated(res, {
      data: result.articles,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  }
);

router.get(
  '/categories',

  async (req, res) => {
    const categories =
      await kbService.getCategories();

    return ApiResponse.success(res, {
      data: categories,
    });
  }
);

router.get(
  '/:id',
  optionalAuth,
  validate(articleIdSchema, 'params'),

  async (req, res) => {
    const article =
      await kbService.getArticleById(
        req.params.id,
        req.user?.id,
        getUserPermissions(req)
      );

    return ApiResponse.success(res, {
      data: article,
    });
  }
);

router.post(
  '/',
  authenticate,
  authorize(PERMISSIONS.KB_CREATE),
  validate(createArticleSchema),

  async (req, res) => {
    const article =
      await kbService.createArticle(
        req.body,
        req.user.id,
        getUserPermissions(req)
      );

    return ApiResponse.created(res, {
      message: 'Article created',
      data: article,
    });
  }
);

router.patch(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.KB_UPDATE),
  validate(articleIdSchema, 'params'),
  validate(updateArticleSchema),

  async (req, res) => {
    const article =
      await kbService.updateArticle(
        req.params.id,
        req.body,
        req.user.id,
        getUserPermissions(req)
      );

    return ApiResponse.success(res, {
      message: 'Article updated',
      data: article,
    });
  }
);

router.delete(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.KB_DELETE),
  validate(articleIdSchema, 'params'),

  async (req, res) => {
    await kbService.deleteArticle(
      req.params.id,
      req.user.id,
      getUserPermissions(req)
    );

    return ApiResponse.success(res, {
      message: 'Article deleted',
      data: {},
    });
  }
);

router.post(
  '/:id/rate',
  authenticate,
  validate(articleIdSchema, 'params'),
  validate(ratingSchema),

  async (req, res) => {
    const result =
      await kbService.rateArticle(
        req.params.id,
        req.user.id,
        req.body.rating,
        req.body.feedback
      );

    return ApiResponse.success(res, {
      message: 'Rating submitted',
      data: result,
    });
  }
);

router.post(
  '/:id/link-ticket',
  authenticate,
  authorize(
    PERMISSIONS.TICKET_UPDATE_ALL
  ),
  validate(articleIdSchema, 'params'),
  validate(linkTicketSchema),

  async (req, res) => {
    const link =
      await kbService.linkArticleToTicket(
        req.params.id,
        req.body.ticketId
      );

    return ApiResponse.success(res, {
      message: 'Article linked to ticket',
      data: link,
    });
  }
);

module.exports = router;