// src/middleware/auth.middleware.js
const {
  verifyAccessToken,
  extractBearerToken,
} = require('../utils/jwt');

const { prisma } = require('../config/database');
const { cacheGet } = require('../config/redis');

const {
  AuthenticationError,
  AuthorizationError,
} = require('../shared/errors');

const { CACHE_KEYS } = require('../shared/constants');

const {
  AUTHENTICATED_USER_SELECT,
  cacheAuthenticatedUser,
} = require('../modules/users/user-cache');

async function authenticate(req, res, next) {
  try {
    const token = extractBearerToken(
      req.headers.authorization
    );

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    const decoded = verifyAccessToken(token);

    const isBlacklisted = await cacheGet(
      `blacklist:${token}`
    );

    if (isBlacklisted) {
      throw new AuthenticationError(
        'Token has been revoked'
      );
    }

    let user = await cacheGet(
      CACHE_KEYS.AUTH_USER(decoded.userId)
    );

    if (!user) {
      user = await prisma.user.findUnique({
        where: {
          id: decoded.userId,
          deletedAt: null,
        },
        select: AUTHENTICATED_USER_SELECT,
      });

      if (user) {
        user = await cacheAuthenticatedUser(user);
      }
    }

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (user.status === 'SUSPENDED') {
      throw new AuthenticationError(
        'Account suspended'
      );
    }

    if (user.status === 'INACTIVE') {
      throw new AuthenticationError(
        'Account inactive'
      );
    }

    req.user = user;
    req.token = token;

    // This update must not prevent the request from completing.
    prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastActiveAt: new Date(),
      },
    }).catch(() => {});

    next();
  } catch (error) {
    next(error);
  }
}

function authorize(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AuthenticationError('Not authenticated')
      );
    }

    const userPermissions =
      req.user.role?.permissions?.map(
        rolePermission =>
          rolePermission.permission.name
      ) || [];

    const hasPermission = permissions.some(
      permission => userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return next(
        new AuthorizationError(
          `Requires permission: ${permissions.join(' or ')}`
        )
      );
    }

    next();
  };
}

/**
 * Allows users to update their own record.
 * Updating another user's record requires an explicit permission.
 */
function authorizeSelfOr(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AuthenticationError('Not authenticated')
      );
    }

    if (req.params.id === req.user.id) {
      return next();
    }

    const userPermissions =
      req.user.role?.permissions?.map(
        rolePermission =>
          rolePermission.permission.name
      ) || [];

    const hasPermission = permissions.some(
      permission => userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return next(
        new AuthorizationError(
          'You cannot update another user without an explicit user update permission'
        )
      );
    }

    next();
  };
}

function requireRoles(...roleNames) {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AuthenticationError('Not authenticated')
      );
    }

    if (!roleNames.includes(req.user.role?.name)) {
      return next(
        new AuthorizationError('Insufficient role')
      );
    }

    next();
  };
}

function optionalAuth(req, res, next) {
  const token = extractBearerToken(
    req.headers.authorization
  );

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);

    prisma.user.findUnique({
      where: {
        id: decoded.userId,
        deletedAt: null,
      },
      select: AUTHENTICATED_USER_SELECT,
    })
      .then(user => {
        req.user = user;
        next();
      })
      .catch(() => next());
  } catch {
    next();
  }
}

module.exports = {
  authenticate,
  authorize,
  authorizeSelfOr,
  requireRoles,
  optionalAuth,
};