// src/modules/knowledge-base/kb.service.js
const { prisma } = require('../../config/database');
const { NotFoundError, AuthorizationError } = require('../../shared/errors');
const { getPagination, buildOrderBy } = require('../../utils/helpers');
const { cacheGet, cacheSet, cacheDel, cacheDelPattern } = require('../../config/redis');
const { CACHE_KEYS, PERMISSIONS } = require('../../shared/constants');

const ARTICLE_SELECT = {
  id: true, title: true, summary: true, status: true, category: true, tags: true,
  viewCount: true, helpfulCount: true, notHelpfulCount: true, isPublic: true,
  createdAt: true, updatedAt: true,
  author: { select: { id: true, firstName: true, lastName: true } },
};

async function getArticles(query, userId, userPermissions) {
  const { page, limit, skip } = getPagination(query);
  const { search, status, category, tags, sortBy, sortOrder } = query;

  const canManage = userPermissions?.includes(PERMISSIONS.KB_UPDATE);
  const where = { deletedAt: null };

  if (!canManage) where.status = 'PUBLISHED';
  else if (status) where.status = status;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } },
      { tags: { has: search } },
    ];
  }
  if (category) where.category = { contains: category, mode: 'insensitive' };
  if (tags) where.tags = { hasSome: Array.isArray(tags) ? tags : [tags] };

  const orderBy = buildOrderBy(sortBy, sortOrder, ['title', 'viewCount', 'createdAt', 'updatedAt']);

  const [articles, total] = await Promise.all([
    prisma.knowledgeArticle.findMany({ where, select: ARTICLE_SELECT, skip, take: limit, orderBy }),
    prisma.knowledgeArticle.count({ where }),
  ]);

  return { articles, total, page, limit };
}

async function getArticleById(id, userId, userPermissions) {
  const canManage = userPermissions?.includes(PERMISSIONS.KB_UPDATE);

  const article = await prisma.knowledgeArticle.findUnique({
    where: { id, deletedAt: null },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      ratings: userId ? { where: { userId }, select: { rating: true, feedback: true } } : false,
    },
  });

  if (!article) throw new NotFoundError('Article not found');
  if (article.status !== 'PUBLISHED' && !canManage) throw new NotFoundError('Article not found');

  // Increment view count (non-blocking)
  prisma.knowledgeArticle.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const userRating = article.ratings?.[0] || null;
  return { ...article, userRating, ratings: undefined };
}

async function createArticle(data, authorId) {
  const article = await prisma.knowledgeArticle.create({
    data: { ...data, authorId },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
  await cacheDelPattern('analytics:kb*');
  return article;
}

async function updateArticle(id, data, userId, userPermissions) {
  const article = await prisma.knowledgeArticle.findUnique({ where: { id, deletedAt: null } });
  if (!article) throw new NotFoundError('Article not found');

  const canUpdate = userPermissions?.includes(PERMISSIONS.KB_UPDATE);
  if (!canUpdate && article.authorId !== userId) throw new AuthorizationError('Cannot update this article');

  const canPublish = userPermissions?.includes(PERMISSIONS.KB_PUBLISH);
  if (data.status === 'PUBLISHED' && !canPublish) {
    throw new AuthorizationError('Cannot publish articles');
  }

  const updated = await prisma.knowledgeArticle.update({
    where: { id },
    data,
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });

  await cacheDel(CACHE_KEYS.KB_ARTICLE(id));
  return updated;
}

async function deleteArticle(id, userId, userPermissions) {
  const article = await prisma.knowledgeArticle.findUnique({ where: { id, deletedAt: null } });
  if (!article) throw new NotFoundError('Article not found');

  const canDelete = userPermissions?.includes(PERMISSIONS.KB_DELETE);
  if (!canDelete && article.authorId !== userId) throw new AuthorizationError('Cannot delete this article');

  await prisma.knowledgeArticle.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
  await cacheDel(CACHE_KEYS.KB_ARTICLE(id));
}

async function rateArticle(articleId, userId, rating, feedback) {
  const article = await prisma.knowledgeArticle.findUnique({ where: { id: articleId, deletedAt: null } });
  if (!article) throw new NotFoundError('Article not found');

  await prisma.articleRating.upsert({
    where: { articleId_userId: { articleId, userId } },
    update: { rating, feedback },
    create: { articleId, userId, rating, feedback },
  });

  // Update counts
  const ratings = await prisma.articleRating.findMany({ where: { articleId } });
  const helpful = ratings.filter(r => r.rating >= 3).length;
  const notHelpful = ratings.filter(r => r.rating < 3).length;

  await prisma.knowledgeArticle.update({ where: { id: articleId }, data: { helpfulCount: helpful, notHelpfulCount: notHelpful } });
}

async function getCategories() {
  const articles = await prisma.knowledgeArticle.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    select: { category: true },
    distinct: ['category'],
  });
  return articles.map(a => a.category);
}

async function linkArticleToTicket(articleId, ticketId) {
  return prisma.knowledgeArticleTicket.upsert({
    where: { articleId_ticketId: { articleId, ticketId } },
    update: {},
    create: { articleId, ticketId },
  });
}

module.exports = { getArticles, getArticleById, createArticle, updateArticle, deleteArticle, rateArticle, getCategories, linkArticleToTicket };
