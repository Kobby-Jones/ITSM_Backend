// src/modules/knowledge-base/kb.service.js
const {
  prisma,
} = require('../../config/database');

const {
  NotFoundError,
  AuthorizationError,
} = require('../../shared/errors');

const {
  getPagination,
  buildOrderBy,
} = require('../../utils/helpers');

const {
  cacheDel,
  cacheDelPattern,
} = require('../../config/redis');

const {
  CACHE_KEYS,
  PERMISSIONS,
} = require('../../shared/constants');

const ARTICLE_SELECT = {
  id: true,
  title: true,
  summary: true,

  /*
   * The Flutter article screen currently obtains article content
   * from the list response.
   */
  content: true,

  status: true,
  category: true,
  tags: true,
  viewCount: true,
  helpfulCount: true,
  notHelpfulCount: true,
  isPublic: true,
  createdAt: true,
  updatedAt: true,

  author: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
};

function hasPermission(
  userPermissions,
  permission
) {
  return (
    Array.isArray(userPermissions)
    && userPermissions.includes(permission)
  );
}

function canManageArticles(
  userPermissions
) {
  return (
    hasPermission(
      userPermissions,
      PERMISSIONS.KB_UPDATE
    )
    || hasPermission(
      userPermissions,
      PERMISSIONS.KB_PUBLISH
    )
    || hasPermission(
      userPermissions,
      PERMISSIONS.KB_DELETE
    )
  );
}

async function invalidateKnowledgeBaseCache(
  articleId
) {
  await Promise.all([
    articleId
      ? cacheDel(
          CACHE_KEYS.KB_ARTICLE(
            articleId
          )
        )
      : Promise.resolve(),

    cacheDelPattern('analytics:kb*'),
  ]);
}

async function getArticles(
  query,
  userId,
  userPermissions = []
) {
  void userId;

  const {
    page,
    limit,
    skip,
  } = getPagination(query);

  const {
    search,
    status,
    category,
    tags,
    sortBy,
    sortOrder,
  } = query;

  const canManage =
    canManageArticles(
      userPermissions
    );

  const where = {
    deletedAt: null,
  };

  /*
   * Ordinary users and unauthenticated visitors must never see
   * drafts, archived articles or non-public articles.
   */
  if (!canManage) {
    where.status = 'PUBLISHED';
    where.isPublic = true;
  } else if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      {
        title: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        content: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        summary: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        tags: {
          has: search,
        },
      },
    ];
  }

  if (category) {
    where.category = {
      contains: category,
      mode: 'insensitive',
    };
  }

  if (tags) {
    where.tags = {
      hasSome:
        Array.isArray(tags)
          ? tags
          : [tags],
    };
  }

  const orderBy = buildOrderBy(
    sortBy,
    sortOrder,
    [
      'title',
      'viewCount',
      'createdAt',
      'updatedAt',
    ]
  );

  const [
    articles,
    total,
  ] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where,
      select: ARTICLE_SELECT,
      skip,
      take: limit,
      orderBy,
    }),

    prisma.knowledgeArticle.count({
      where,
    }),
  ]);

  return {
    articles,
    total,
    page,
    limit,
  };
}

async function getArticleById(
  id,
  userId,
  userPermissions = []
) {
  const accessRecord =
    await prisma
      .knowledgeArticle
      .findUnique({
        where: {
          id,
          deletedAt: null,
        },

        select: {
          id: true,
          status: true,
          isPublic: true,
        },
      });

  if (!accessRecord) {
    throw new NotFoundError(
      'Article not found'
    );
  }

  const canManage =
    canManageArticles(
      userPermissions
    );

  if (
    !canManage
    && (
      accessRecord.status
        !== 'PUBLISHED'
      || !accessRecord.isPublic
    )
  ) {
    throw new NotFoundError(
      'Article not found'
    );
  }

  /*
   * The increment is awaited and the updated record is returned.
   * This avoids the previous view-count race condition.
   */
  const article =
    await prisma
      .knowledgeArticle
      .update({
        where: {
          id,
        },

        data: {
          viewCount: {
            increment: 1,
          },
        },

        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },

          ratings: userId
            ? {
                where: {
                  userId,
                },

                select: {
                  rating: true,
                  feedback: true,
                },
              }
            : false,

          relatedTickets: {
            select: {
              ticketId: true,
            },
          },
        },
      });

  const userRating =
    article.ratings?.[0]
    || null;

  return {
    ...article,
    userRating,
    ratings: undefined,
  };
}

async function createArticle(
  data,
  authorId,
  userPermissions = []
) {
  /*
   * KB_CREATE allows a person to draft content. Publishing
   * requires the separate KB_PUBLISH permission.
   */
  if (
    data.status === 'PUBLISHED'
    && !hasPermission(
      userPermissions,
      PERMISSIONS.KB_PUBLISH
    )
  ) {
    throw new AuthorizationError(
      'Cannot publish articles'
    );
  }

  const summary =
    data.summary?.trim()
    || data.content
      .slice(0, 240)
      .trim();

  const article =
    await prisma
      .knowledgeArticle
      .create({
        data: {
          ...data,
          summary,
          authorId,
        },

        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

  await invalidateKnowledgeBaseCache(
    article.id
  );

  return article;
}

async function updateArticle(
  id,
  data,
  userId,
  userPermissions = []
) {
  const article =
    await prisma
      .knowledgeArticle
      .findUnique({
        where: {
          id,
          deletedAt: null,
        },
      });

  if (!article) {
    throw new NotFoundError(
      'Article not found'
    );
  }

  const canUpdate =
    hasPermission(
      userPermissions,
      PERMISSIONS.KB_UPDATE
    );

  if (
    !canUpdate
    && article.authorId !== userId
  ) {
    throw new AuthorizationError(
      'Cannot update this article'
    );
  }

  if (
    data.status === 'PUBLISHED'
    && !hasPermission(
      userPermissions,
      PERMISSIONS.KB_PUBLISH
    )
  ) {
    throw new AuthorizationError(
      'Cannot publish articles'
    );
  }

  const updated =
    await prisma
      .knowledgeArticle
      .update({
        where: {
          id,
        },

        data,

        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

  await invalidateKnowledgeBaseCache(
    id
  );

  return updated;
}

async function deleteArticle(
  id,
  userId,
  userPermissions = []
) {
  const article =
    await prisma
      .knowledgeArticle
      .findUnique({
        where: {
          id,
          deletedAt: null,
        },
      });

  if (!article) {
    throw new NotFoundError(
      'Article not found'
    );
  }

  const canDelete =
    hasPermission(
      userPermissions,
      PERMISSIONS.KB_DELETE
    );

  if (
    !canDelete
    && article.authorId !== userId
  ) {
    throw new AuthorizationError(
      'Cannot delete this article'
    );
  }

  await prisma
    .knowledgeArticle
    .update({
      where: {
        id,
      },

      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED',
      },
    });

  await invalidateKnowledgeBaseCache(
    id
  );
}

async function rateArticle(
  articleId,
  userId,
  rating,
  feedback
) {
  const article =
    await prisma
      .knowledgeArticle
      .findUnique({
        where: {
          id: articleId,
          deletedAt: null,
        },

        select: {
          id: true,
          status: true,
          isPublic: true,
        },
      });

  /*
   * Users must not rate drafts, archived content or private
   * articles by guessing their IDs.
   */
  if (
    !article
    || article.status
      !== 'PUBLISHED'
    || !article.isPublic
  ) {
    throw new NotFoundError(
      'Article not found'
    );
  }

  const savedRating =
    await prisma
      .articleRating
      .upsert({
        where: {
          articleId_userId: {
            articleId,
            userId,
          },
        },

        update: {
          rating,
          feedback,
        },

        create: {
          articleId,
          userId,
          rating,
          feedback,
        },

        select: {
          rating: true,
          feedback: true,
        },
      });

  const [
    ratingAggregate,
    helpfulCount,
    notHelpfulCount,
  ] = await Promise.all([
    prisma.articleRating.aggregate({
      where: {
        articleId,
      },

      _avg: {
        rating: true,
      },

      _count: {
        rating: true,
      },
    }),

    prisma.articleRating.count({
      where: {
        articleId,

        rating: {
          gte: 3,
        },
      },
    }),

    prisma.articleRating.count({
      where: {
        articleId,

        rating: {
          lt: 3,
        },
      },
    }),
  ]);

  await prisma
    .knowledgeArticle
    .update({
      where: {
        id: articleId,
      },

      data: {
        helpfulCount,
        notHelpfulCount,
      },
    });

  await invalidateKnowledgeBaseCache(
    articleId
  );

  return {
    rating:
      savedRating.rating,

    feedback:
      savedRating.feedback,

    averageRating:
      ratingAggregate
        ._avg
        .rating
      || 0,

    totalRatings:
      ratingAggregate
        ._count
        .rating,

    helpfulCount,
    notHelpfulCount,
  };
}

async function getCategories() {
  const categories =
    await prisma
      .knowledgeArticle
      .groupBy({
        by: [
          'category',
        ],

        where: {
          status: 'PUBLISHED',
          isPublic: true,
          deletedAt: null,
        },

        _count: {
          id: true,
        },

        orderBy: {
          category: 'asc',
        },
      });

  return categories.map(
    category => ({
      category:
        category.category,

      count:
        category._count.id,
    })
  );
}

async function linkArticleToTicket(
  articleId,
  ticketId
) {
  const [
    article,
    ticket,
  ] = await Promise.all([
    prisma
      .knowledgeArticle
      .findUnique({
        where: {
          id: articleId,
          deletedAt: null,
        },

        select: {
          id: true,
        },
      }),

    prisma.ticket.findUnique({
      where: {
        id: ticketId,
        deletedAt: null,
      },

      select: {
        id: true,
      },
    }),
  ]);

  if (!article) {
    throw new NotFoundError(
      'Article not found'
    );
  }

  if (!ticket) {
    throw new NotFoundError(
      'Ticket not found'
    );
  }

  const link =
    await prisma
      .knowledgeArticleTicket
      .upsert({
        where: {
          articleId_ticketId: {
            articleId,
            ticketId,
          },
        },

        update: {},

        create: {
          articleId,
          ticketId,
        },
      });

  await invalidateKnowledgeBaseCache(
    articleId
  );

  return link;
}

module.exports = {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  rateArticle,
  getCategories,
  linkArticleToTicket,
};