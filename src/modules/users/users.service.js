// src/modules/users/users.service.js
const bcrypt = require('bcryptjs');
const { prisma } = require('../../config/database');
const { cacheDel, cacheGet, cacheSet } = require('../../config/redis');
const { NotFoundError, ConflictError, AppError } = require('../../shared/errors');
const { getPagination, buildOrderBy } = require('../../utils/helpers');
const { CACHE_KEYS } = require('../../shared/constants');

const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true, phone: true,
  avatarUrl: true, employeeId: true, status: true, emailVerified: true,
  lastLoginAt: true, lastActiveAt: true, createdAt: true, updatedAt: true,
  role: { select: { id: true, name: true, displayName: true } },
  department: { select: { id: true, name: true, code: true } },
};

async function getUsers(query) {
  const { page, limit, skip } = getPagination(query);
  const { search, status, roleId, departmentId, sortBy, sortOrder } = query;

  const where = { deletedAt: null };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status) where.status = status;
  if (roleId) where.roleId = roleId;
  if (departmentId) where.departmentId = departmentId;

  const orderBy = buildOrderBy(sortBy, sortOrder, ['firstName', 'lastName', 'email', 'createdAt', 'status']);

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: USER_SELECT, skip, take: limit, orderBy }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit };
}

async function getUserById(id) {
  const cached = await cacheGet(CACHE_KEYS.USER(id));
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { id, deletedAt: null },
    select: {
      ...USER_SELECT,
      _count: { select: { createdTickets: true, assignedTickets: true, assetAssignments: true } },
    },
  });
  if (!user) throw new NotFoundError('User not found');

  await cacheSet(CACHE_KEYS.USER(id), user, 300);
  return user;
}

async function updateUser(id, data, requesterId, requesterRole) {
  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError('User not found');

  // Only admins can update other users
  if (id !== requesterId && !['super_admin', 'it_admin', 'it_manager'].includes(requesterRole)) {
    throw new AppError('Cannot update another user', 403);
  }

  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictError('Email already in use');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      employeeId: data.employeeId,
      departmentId: data.departmentId,
      fcmToken: data.fcmToken,
    },
    select: USER_SELECT,
  });

  await cacheDel(CACHE_KEYS.USER(id));
  return updated;
}

async function updateUserRole(id, roleId) {
  const [user, role] = await Promise.all([
    prisma.user.findUnique({ where: { id, deletedAt: null } }),
    prisma.role.findUnique({ where: { id: roleId } }),
  ]);
  if (!user) throw new NotFoundError('User not found');
  if (!role) throw new NotFoundError('Role not found');

  const updated = await prisma.user.update({ where: { id }, data: { roleId }, select: USER_SELECT });
  await cacheDel(CACHE_KEYS.USER(id));
  return updated;
}

async function updateUserStatus(id, status) {
  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError('User not found');

  const updated = await prisma.user.update({ where: { id }, data: { status }, select: USER_SELECT });
  await cacheDel(CACHE_KEYS.USER(id));
  return updated;
}

async function softDeleteUser(id) {
  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError('User not found');

  await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
  await prisma.session.updateMany({ where: { userId: id }, data: { isValid: false } });
  await cacheDel(CACHE_KEYS.USER(id));
}

async function updateAvatar(id, avatarUrl) {
  await prisma.user.update({ where: { id }, data: { avatarUrl } });
  await cacheDel(CACHE_KEYS.USER(id));
  return { avatarUrl };
}

async function updateFcmToken(id, fcmToken) {
  await prisma.user.update({ where: { id }, data: { fcmToken } });
  await cacheDel(CACHE_KEYS.USER(id));
}

async function getUserStats(id) {
  const [ticketStats, assetCount] = await Promise.all([
    prisma.ticket.groupBy({
      by: ['status'],
      where: { creatorId: id, deletedAt: null },
      _count: { id: true },
    }),
    prisma.assetAssignment.count({ where: { userId: id, isActive: true } }),
  ]);

  const stats = { total: 0, open: 0, resolved: 0, closed: 0, inProgress: 0 };
  for (const s of ticketStats) {
    stats.total += s._count.id;
    if (s.status === 'OPEN') stats.open = s._count.id;
    else if (s.status === 'RESOLVED') stats.resolved = s._count.id;
    else if (s.status === 'CLOSED') stats.closed = s._count.id;
    else if (s.status === 'IN_PROGRESS') stats.inProgress = s._count.id;
  }

  return { tickets: stats, assignedAssets: assetCount };
}

async function getTechnicians() {
  const techRole = await prisma.role.findUnique({ where: { name: 'it_technician' } });
  if (!techRole) return [];

  const technicians = await prisma.user.findMany({
    where: { roleId: techRole.id, status: 'ACTIVE', deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      _count: { select: { assignedTickets: { where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } } } },
    },
    orderBy: { firstName: 'asc' },
  });

  return technicians.map(t => ({
    ...t,
    activeTicketCount: t._count.assignedTickets,
    _count: undefined,
  }));
}

module.exports = {
  getUsers, getUserById, updateUser, updateUserRole, updateUserStatus,
  softDeleteUser, updateAvatar, updateFcmToken, getUserStats, getTechnicians,
};
