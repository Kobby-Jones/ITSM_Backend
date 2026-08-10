// src/modules/roles/roles.routes.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const ApiResponse = require('../../shared/response');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { PERMISSIONS } = require('../../shared/constants');
const { cacheGet, cacheSet } = require('../../config/redis');

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Role and Permission Management
 */

router.use(authenticate);

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Get all roles with permissions
 *     tags: [Roles]
 */
router.get('/', authorize(PERMISSIONS.SYSTEM_CONFIG), async (req, res) => {
  const cached = await cacheGet('roles:all');
  if (cached) return ApiResponse.success(res, { data: cached });

  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } } },
    orderBy: { name: 'asc' },
  });
  await cacheSet('roles:all', roles, 300);
  ApiResponse.success(res, { data: roles });
});

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Roles]
 */
router.get('/:id', authorize(PERMISSIONS.SYSTEM_CONFIG), async (req, res) => {
  const role = await prisma.role.findUnique({
    where: { id: req.params.id },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) return ApiResponse.notFound(res, { message: 'Role not found' });
  ApiResponse.success(res, { data: role });
});

/**
 * @swagger
 * /roles:
 *   post:
 *     summary: Create custom role
 *     tags: [Roles]
 */
router.post('/', authorize(PERMISSIONS.SYSTEM_CONFIG), async (req, res) => {
  const { name, displayName, description, permissionIds = [] } = req.body;
  const role = await prisma.role.create({
    data: {
      name, displayName, description,
      permissions: {
        create: permissionIds.map(permissionId => ({ permissionId })),
      },
    },
    include: { permissions: { include: { permission: true } } },
  });
  ApiResponse.created(res, { message: 'Role created', data: role });
});

/**
 * @swagger
 * /roles/{id}/permissions:
 *   put:
 *     summary: Update role permissions
 *     tags: [Roles]
 */
router.put('/:id/permissions', authorize(PERMISSIONS.SYSTEM_CONFIG), async (req, res) => {
  const { permissionIds = [] } = req.body;
  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) return ApiResponse.notFound(res, { message: 'Role not found' });
  if (role.isSystem) return ApiResponse.forbidden(res, { message: 'Cannot modify system role permissions' });

  await prisma.rolePermission.deleteMany({ where: { roleId: req.params.id } });
  await prisma.rolePermission.createMany({
    data: permissionIds.map(permissionId => ({ roleId: req.params.id, permissionId })),
    skipDuplicates: true,
  });

  const updated = await prisma.role.findUnique({
    where: { id: req.params.id },
    include: { permissions: { include: { permission: true } } },
  });
  ApiResponse.success(res, { message: 'Permissions updated', data: updated });
});

/**
 * @swagger
 * /permissions:
 *   get:
 *     summary: Get all permissions
 *     tags: [Roles]
 */
router.get('/permissions/all', authorize(PERMISSIONS.SYSTEM_CONFIG), async (req, res) => {
  const permissions = await prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  ApiResponse.success(res, { data: permissions });
});

// ============================================================
// src/modules/audit/audit.routes.js
// ============================================================
const auditRouter = express.Router();
const auditAuth = require('../../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Audit
 *   description: System Audit Logs
 */

auditRouter.use(authenticate);
auditRouter.use(authorize(PERMISSIONS.SYSTEM_AUDIT));

/**
 * @swagger
 * /audit:
 *   get:
 *     summary: Get audit logs
 *     tags: [Audit]
 */
auditRouter.get('/', async (req, res) => {
  const { page = 1, limit = 50, userId, action, resource, from, to } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.auditLog.count({ where }),
  ]);

  ApiResponse.paginated(res, { data: logs, total, page: parseInt(page), limit: parseInt(limit) });
});

module.exports = { rolesRouter: router, auditRouter };
