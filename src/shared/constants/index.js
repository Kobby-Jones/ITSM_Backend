// src/shared/constants/index.js

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  IT_MANAGER: 'it_manager',
  IT_ADMIN: 'it_admin',
  IT_TECHNICIAN: 'it_technician',
  END_USER: 'end_user',
};

const PERMISSIONS = {
  TICKET_CREATE: 'ticket:create',
  TICKET_READ_OWN: 'ticket:read:own',
  TICKET_READ_ALL: 'ticket:read:all',
  TICKET_UPDATE_OWN: 'ticket:update:own',
  TICKET_UPDATE_ALL: 'ticket:update:all',
  TICKET_DELETE: 'ticket:delete',
  TICKET_ASSIGN: 'ticket:assign',
  TICKET_ESCALATE: 'ticket:escalate',
  TICKET_CLOSE: 'ticket:close',
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE_ROLES: 'user:manage:roles',
  ASSET_CREATE: 'asset:create',
  ASSET_READ: 'asset:read',
  ASSET_UPDATE: 'asset:update',
  ASSET_DELETE: 'asset:delete',
  ASSET_ASSIGN: 'asset:assign',
  KB_CREATE: 'kb:create',
  KB_READ: 'kb:read',
  KB_UPDATE: 'kb:update',
  KB_DELETE: 'kb:delete',
  KB_PUBLISH: 'kb:publish',
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_EXPORT: 'analytics:export',
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_AUDIT: 'system:audit',
  SYSTEM_ROUTING: 'system:routing',
  SYSTEM_SLA: 'system:sla',
};

const TICKET_STATUS = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  ESCALATED: 'ESCALATED',
};

const TICKET_PRIORITY = {
  P1_CRITICAL: 'P1_CRITICAL',
  P2_HIGH: 'P2_HIGH',
  P3_MEDIUM: 'P3_MEDIUM',
  P4_LOW: 'P4_LOW',
};

const TICKET_CATEGORY = {
  NETWORK_CONNECTIVITY: 'NETWORK_CONNECTIVITY',
  HARDWARE_ISSUES: 'HARDWARE_ISSUES',
  SOFTWARE_APPLICATION: 'SOFTWARE_APPLICATION',
  ACCOUNT_ACCESS_IDENTITY: 'ACCOUNT_ACCESS_IDENTITY',
  PRINTING_PROBLEMS: 'PRINTING_PROBLEMS',
  PRODUCTION_SYSTEMS: 'PRODUCTION_SYSTEMS',
};

const SLA_CONFIG = {
  P1_CRITICAL: { response: 15, resolution: 240 },
  P2_HIGH: { response: 60, resolution: 480 },
  P3_MEDIUM: { response: 240, resolution: 1440 },
  P4_LOW: { response: 480, resolution: 4320 },
};

const CACHE_KEYS = {
  // Authentication and API response caches must never share a key.
  AUTH_USER: (id) => 'auth:user:' + id,
  PUBLIC_USER: (id) => 'public:user:' + id,

  // Legacy key retained temporarily so older cached records can be removed.
  USER: (id) => `user:${id}`,

  USER_PERMISSIONS: (id) => `user:perms:${id}`,
  DASHBOARD: (userId) => `dashboard:${userId}`,
  ANALYTICS: (key) => `analytics:${key}`,
  KB_ARTICLE: (id) => `kb:${id}`,
  ROLES_ALL: 'roles:all',
  SLA_CONFIG: 'sla:config',
};

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

module.exports = {
  ROLES,
  PERMISSIONS,
  TICKET_STATUS,
  TICKET_PRIORITY,
  TICKET_CATEGORY,
  SLA_CONFIG,
  CACHE_KEYS,
  PAGINATION,
};