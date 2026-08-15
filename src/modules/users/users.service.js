// src/modules/users/users.service.js
const { prisma } = require('../../config/database');

const {
  cacheGet,
  cacheSet,
} = require('../../config/redis');

const {
  NotFoundError,
  ConflictError,
  AuthorizationError,
} = require('../../shared/errors');

const {
  getPagination,
  buildOrderBy,
} = require('../../utils/helpers');

const {
  CACHE_KEYS,
  PERMISSIONS,
} = require('../../shared/constants');

const {
  invalidateUserCaches,
} = require('./user-cache');

const USER_SELECT = {
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

  role: {
    select: {
      id: true,
      name: true,
      displayName: true,
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

async function getUsers(query) {
  const {
    page,
    limit,
    skip,
  } = getPagination(query);

  const {
    search,
    status,
    roleId,
    departmentId,
    sortBy,
    sortOrder,
  } = query;

  const where = {
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      {
        firstName: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        lastName: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        email: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        employeeId: {
          contains: search,
          mode: 'insensitive',
        },
      },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (roleId) {
    where.roleId = roleId;
  }

  if (departmentId) {
    where.departmentId = departmentId;
  }

  const orderBy = buildOrderBy(
    sortBy,
    sortOrder,
    [
      'firstName',
      'lastName',
      'email',
      'createdAt',
      'status',
    ]
  );

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      skip,
      take: limit,
      orderBy,
    }),

    prisma.user.count({
      where,
    }),
  ]);

  return {
    users,
    total,
    page,
    limit,
  };
}

async function getUserById(id) {
  const cached = await cacheGet(
    CACHE_KEYS.PUBLIC_USER(id)
  );

  if (cached) {
    return cached;
  }

  const user = await prisma.user.findUnique({
    where: {
      id,
      deletedAt: null,
    },

    select: {
      ...USER_SELECT,

      _count: {
        select: {
          createdTickets: true,
          assignedTickets: true,
          assetAssignments: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  await cacheSet(
    CACHE_KEYS.PUBLIC_USER(id),
    user,
    300
  );

  return user;
}

async function updateUser(
  id,
  data,
  requesterId,
  requesterPermissions
) {
  const user = await prisma.user.findUnique({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const canUpdateOtherUsers =
    Array.isArray(requesterPermissions)
    && requesterPermissions.includes(
      PERMISSIONS.USER_UPDATE
    );

  if (
    id !== requesterId
    && !canUpdateOtherUsers
  ) {
    throw new AuthorizationError(
      'Cannot update another user'
    );
  }

  if (
    data.email
    && data.email !== user.email
  ) {
    const existing = await prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (existing) {
      throw new ConflictError(
        'Email already in use'
      );
    }
  }

  const updateData = {};

  if (data.firstName !== undefined) {
    updateData.firstName = data.firstName;
  }

  if (data.lastName !== undefined) {
    updateData.lastName = data.lastName;
  }

  if (data.phone !== undefined) {
    updateData.phone = data.phone;
  }

  if (data.employeeId !== undefined) {
    updateData.employeeId = data.employeeId;
  }

  if (data.departmentId !== undefined) {
    updateData.departmentId = data.departmentId;
  }

  const updated = await prisma.user.update({
    where: {
      id,
    },

    data: updateData,

    select: USER_SELECT,
  });

  await invalidateUserCaches(id);

  return updated;
}

async function updateUserRole(id, roleId) {
  const [user, role] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id,
        deletedAt: null,
      },
    }),

    prisma.role.findUnique({
      where: {
        id: roleId,
      },
    }),
  ]);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (!role) {
    throw new NotFoundError('Role not found');
  }

  const updated = await prisma.user.update({
    where: {
      id,
    },

    data: {
      roleId,
    },

    select: USER_SELECT,
  });

  await invalidateUserCaches(id);

  return updated;
}

async function updateUserStatus(id, status) {
  const user = await prisma.user.findUnique({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updated = await prisma.user.update({
    where: {
      id,
    },

    data: {
      status,
    },

    select: USER_SELECT,
  });

  await invalidateUserCaches(id);

  return updated;
}

async function softDeleteUser(id) {
  const user = await prisma.user.findUnique({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  await prisma.user.update({
    where: {
      id,
    },

    data: {
      deletedAt: new Date(),
      status: 'INACTIVE',
    },
  });

  await prisma.session.updateMany({
    where: {
      userId: id,
    },

    data: {
      isValid: false,
    },
  });

  await invalidateUserCaches(id);
}

async function updateAvatar(id, avatarUrl) {
  await prisma.user.update({
    where: {
      id,
    },

    data: {
      avatarUrl,
    },
  });

  await invalidateUserCaches(id);

  return {
    avatarUrl,
  };
}

async function updateFcmToken(id, fcmToken) {
  await prisma.user.update({
    where: {
      id,
    },

    data: {
      fcmToken,
    },
  });

  await invalidateUserCaches(id);
}

async function getUserStats(id) {
  const [ticketStats, assetCount] =
    await Promise.all([
      prisma.ticket.groupBy({
        by: ['status'],

        where: {
          creatorId: id,
          deletedAt: null,
        },

        _count: {
          id: true,
        },
      }),

      prisma.assetAssignment.count({
        where: {
          userId: id,
          isActive: true,
        },
      }),
    ]);

  const stats = {
    total: 0,
    open: 0,
    resolved: 0,
    closed: 0,
    inProgress: 0,
  };

  for (const statusGroup of ticketStats) {
    stats.total += statusGroup._count.id;

    if (statusGroup.status === 'OPEN') {
      stats.open = statusGroup._count.id;
    } else if (
      statusGroup.status === 'RESOLVED'
    ) {
      stats.resolved = statusGroup._count.id;
    } else if (
      statusGroup.status === 'CLOSED'
    ) {
      stats.closed = statusGroup._count.id;
    } else if (
      statusGroup.status === 'IN_PROGRESS'
    ) {
      stats.inProgress = statusGroup._count.id;
    }
  }

  return {
    tickets: stats,
    assignedAssets: assetCount,
  };
}

async function getTechnicians() {
  const technicianRole =
    await prisma.role.findUnique({
      where: {
        name: 'it_technician',
      },
    });

  if (!technicianRole) {
    return [];
  }

  const technicians =
    await prisma.user.findMany({
      where: {
        roleId: technicianRole.id,
        status: 'ACTIVE',
        deletedAt: null,
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,

        _count: {
          select: {
            assignedTickets: {
              where: {
                status: {
                  notIn: [
                    'RESOLVED',
                    'CLOSED',
                  ],
                },
              },
            },
          },
        },
      },

      orderBy: {
        firstName: 'asc',
      },
    });

  return technicians.map(technician => ({
    id: technician.id,
    firstName: technician.firstName,
    lastName: technician.lastName,
    email: technician.email,
    activeTicketCount:
      technician._count.assignedTickets,
  }));
}

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  updateUserRole,
  updateUserStatus,
  softDeleteUser,
  updateAvatar,
  updateFcmToken,
  getUserStats,
  getTechnicians,
};