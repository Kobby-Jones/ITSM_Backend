// src/middleware/auth.middleware.js
const { verifyAccessToken, extractBearerToken } = require('../utils/jwt');
const { prisma } = require('../config/database');
const { cacheGet, cacheSet } = require('../config/redis');
const { AuthenticationError, AuthorizationError } = require('../shared/errors');
const { CACHE_KEYS } = require('../shared/constants');

async function authenticate(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) throw new AuthenticationError('No token provided');

    const decoded = verifyAccessToken(token);

    // Check token blacklist
    const isBlacklisted = await cacheGet(`blacklist:${token}`);
    if (isBlacklisted) throw new AuthenticationError('Token has been revoked');

    // Try cache first
    let user = await cacheGet(CACHE_KEYS.USER(decoded.userId));

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId, deletedAt: null },
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      });
      if (user) await cacheSet(CACHE_KEYS.USER(decoded.userId), user, 300);
    }

    if (!user) throw new AuthenticationError('User not found');
    if (user.status === 'SUSPENDED') throw new AuthenticationError('Account suspended');
    if (user.status === 'INACTIVE') throw new AuthenticationError('Account inactive');

    req.user = user;
    req.token = token;

    // Update last active (non-blocking)
    prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    }).catch(() => {});

    next();
  } catch (err) {
    next(err);
  }
}

function authorize(...permissions) {
  return (req, res, next) => {
    if (!req.user) return next(new AuthenticationError('Not authenticated'));

    const userPermissions = req.user.role?.permissions?.map(rp => rp.permission.name) || [];
    const hasPermission = permissions.some(p => userPermissions.includes(p));

    if (!hasPermission) {
      return next(new AuthorizationError(`Requires permission: ${permissions.join(' or ')}`));
    }
    next();
  };
}

function requireRoles(...roleNames) {
  return (req, res, next) => {
    if (!req.user) return next(new AuthenticationError('Not authenticated'));
    if (!roleNames.includes(req.user.role?.name)) {
      return next(new AuthorizationError('Insufficient role'));
    }
    next();
  };
}

function optionalAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    prisma.user.findUnique({
      where: { id: decoded.userId, deletedAt: null },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    }).then(user => {
      req.user = user;
      next();
    }).catch(() => next());
  } catch {
    next();
  }
}

module.exports = { authenticate, authorize, requireRoles, optionalAuth };
