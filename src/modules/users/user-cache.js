// src/modules/users/user-cache.js
const { cacheDel, cacheSet } = require('../../config/redis');
const { CACHE_KEYS } = require('../../shared/constants');

const AUTHENTICATED_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  employeeId: true,
  status: true,
  emailVerified: true,
  lastLoginAt: true,
  lastActiveAt: true,
  createdAt: true,
  updatedAt: true,
  roleId: true,
  departmentId: true,

  role: {
    select: {
      id: true,
      name: true,
      displayName: true,

      permissions: {
        select: {
          permission: {
            select: {
              id: true,
              name: true,
              resource: true,
              action: true,
            },
          },
        },
      },
    },
  },

  department: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
};

/**
 * Builds a strictly allow-listed user object for authentication caching.
 *
 * Do not replace this with object spreading or a "remove password" operation.
 * Using an allow-list means newly added sensitive database fields remain
 * private by default.
 */
function toAuthenticatedUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    employeeId: user.employeeId ?? null,
    status: user.status,
    emailVerified: Boolean(user.emailVerified),
    lastLoginAt: user.lastLoginAt ?? null,
    lastActiveAt: user.lastActiveAt ?? null,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
    roleId: user.roleId,
    departmentId: user.departmentId ?? null,

    role: user.role
      ? {
          id: user.role.id,
          name: user.role.name,
          displayName: user.role.displayName,

          permissions: (user.role.permissions || []).map(
            rolePermission => ({
              permission: {
                id: rolePermission.permission.id,
                name: rolePermission.permission.name,
                resource: rolePermission.permission.resource,
                action: rolePermission.permission.action,
              },
            })
          ),
        }
      : null,

    department: user.department
      ? {
          id: user.department.id,
          name: user.department.name,
          code: user.department.code,
        }
      : null,
  };
}

async function cacheAuthenticatedUser(user, ttl = 300) {
  const safeUser = toAuthenticatedUser(user);

  if (!safeUser) {
    return null;
  }

  // Remove data cached using the unsafe legacy key.
  await cacheDel(CACHE_KEYS.USER(safeUser.id));

  await cacheSet(
    CACHE_KEYS.AUTH_USER(safeUser.id),
    safeUser,
    ttl
  );

  return safeUser;
}

async function invalidateUserCaches(userId) {
  await Promise.all([
    cacheDel(CACHE_KEYS.AUTH_USER(userId)),
    cacheDel(CACHE_KEYS.PUBLIC_USER(userId)),
    cacheDel(CACHE_KEYS.USER(userId)),
    cacheDel(CACHE_KEYS.USER_PERMISSIONS(userId)),
  ]);
}

module.exports = {
  AUTHENTICATED_USER_SELECT,
  toAuthenticatedUser,
  cacheAuthenticatedUser,
  invalidateUserCaches,
};