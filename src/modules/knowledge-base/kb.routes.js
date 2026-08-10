// src/modules/knowledge-base/kb.routes.js
const express = require('express');
const router = express.Router();
const kbService = require('./kb.service');
const ApiResponse = require('../../shared/response');
const { authenticate, optionalAuth, authorize } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/index');
const Joi = require('joi');
const { PERMISSIONS } = require('../../shared/constants');

const articleSchema = Joi.object({
  title: Joi.string().min(5).max(200).trim().required(),
  content: Joi.string().min(20).required(),
  summary: Joi.string().max(500).allow('', null),
  status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED').default('DRAFT'),
  category: Joi.string().min(2).max(100).trim().required(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).default([]),
  isPublic: Joi.boolean().default(true),
});

router.get('/', optionalAuth, async (req, res) => {
  const perms = req.user?.role?.permissions?.map(rp => rp.permission.name) || [];
  const result = await kbService.getArticles(req.query, req.user?.id, perms);
  ApiResponse.paginated(res, { data: result.articles, total: result.total, page: result.page, limit: result.limit });
});

router.get('/categories', async (req, res) => {
  const categories = await kbService.getCategories();
  ApiResponse.success(res, { data: categories });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const perms = req.user?.role?.permissions?.map(rp => rp.permission.name) || [];
  const article = await kbService.getArticleById(req.params.id, req.user?.id, perms);
  ApiResponse.success(res, { data: article });
});

router.post('/', authenticate, authorize(PERMISSIONS.KB_CREATE), validate(articleSchema), async (req, res) => {
  const article = await kbService.createArticle(req.body, req.user.id);
  ApiResponse.created(res, { message: 'Article created', data: article });
});

router.patch('/:id', authenticate, authorize(PERMISSIONS.KB_UPDATE), async (req, res) => {
  const perms = req.user?.role?.permissions?.map(rp => rp.permission.name) || [];
  const article = await kbService.updateArticle(req.params.id, req.body, req.user.id, perms);
  ApiResponse.success(res, { message: 'Article updated', data: article });
});

router.delete('/:id', authenticate, authorize(PERMISSIONS.KB_DELETE), async (req, res) => {
  const perms = req.user?.role?.permissions?.map(rp => rp.permission.name) || [];
  await kbService.deleteArticle(req.params.id, req.user.id, perms);
  ApiResponse.success(res, { message: 'Article deleted', data: {} });
});

router.post('/:id/rate', authenticate,
  validate(Joi.object({ rating: Joi.number().integer().min(1).max(5).required(), feedback: Joi.string().max(500).allow('', null) })),
  async (req, res) => {
    await kbService.rateArticle(req.params.id, req.user.id, req.body.rating, req.body.feedback);
    ApiResponse.success(res, { message: 'Rating submitted', data: {} });
  }
);

router.post('/:id/link-ticket', authenticate, authorize(PERMISSIONS.TICKET_UPDATE_ALL),
  validate(Joi.object({ ticketId: Joi.string().uuid().required() })),
  async (req, res) => {
    await kbService.linkArticleToTicket(req.params.id, req.body.ticketId);
    ApiResponse.success(res, { message: 'Article linked to ticket', data: {} });
  }
);

module.exports = router;
