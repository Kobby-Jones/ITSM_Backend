const { prisma } = require('../../config/database');

const {
  NotFoundError,
  ConflictError,
} = require('../../shared/errors');

const {
  getPagination,
  buildOrderBy,
  generateAssetTag,
} = require('../../utils/helpers');

const notificationService = require(
  '../notifications/notifications.service'
);

const logger = require('../../config/logger');

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,

  department: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
};

const ASSIGNMENT_SELECT = {
  id: true,
  assetId: true,
  userId: true,
  assignedById: true,
  assignedAt: true,
  returnedAt: true,
  notes: true,
  isActive: true,
  createdAt: true,

  user: {
    select: USER_SELECT,
  },
};

const ASSET_LIST_SELECT = {
  id: true,
  assetTag: true,
  name: true,
  description: true,
  category: true,
  status: true,
  make: true,
  model: true,
  serialNumber: true,
  purchaseDate: true,
  purchasePrice: true,
  warrantyExpiry: true,
  location: true,
  specifications: true,
  notes: true,
  departmentId: true,
  createdAt: true,
  updatedAt: true,

  department: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },

  assignments: {
    where: {
      isActive: true,
    },

    select: ASSIGNMENT_SELECT,

    orderBy: {
      assignedAt: 'desc',
    },

    take: 1,
  },

  _count: {
    select: {
      assignments: true,
    },
  },
};

const ASSET_DETAIL_SELECT = {
  ...ASSET_LIST_SELECT,

  assignments: {
    select: ASSIGNMENT_SELECT,

    orderBy: {
      assignedAt: 'desc',
    },
  },
};

const NULLABLE_STRING_FIELDS = [
  'description',
  'make',
  'model',
  'serialNumber',
  'location',
  'notes',
];

function normalizeAssetData(data) {
  const normalized = {
    ...data,
  };

  for (const field of NULLABLE_STRING_FIELDS) {
    if (normalized[field] === '') {
      normalized[field] = null;
    }
  }

  if (
    normalized.assetTag === ''
    || normalized.assetTag === null
  ) {
    delete normalized.assetTag;
  }

  return normalized;
}

async function assertUniqueAssetFields(
  data,
  excludedAssetId
) {
  const conditions = [];

  if (data.assetTag) {
    conditions.push({
      assetTag: data.assetTag,
    });
  }

  if (data.serialNumber) {
    conditions.push({
      serialNumber: data.serialNumber,
    });
  }

  if (conditions.length === 0) {
    return;
  }

  const existing = await prisma.asset.findFirst({
    where: {
      ...(excludedAssetId
        ? {
            id: {
              not: excludedAssetId,
            },
          }
        : {}),

      OR: conditions,
    },

    select: {
      id: true,
      assetTag: true,
      serialNumber: true,
    },
  });

  if (!existing) {
    return;
  }

  if (
    data.assetTag
    && existing.assetTag === data.assetTag
  ) {
    throw new ConflictError(
      'Asset tag already exists'
    );
  }

  throw new ConflictError(
    'Asset with this serial number already exists'
  );
}

async function getAssets(query) {
  const {
    page,
    limit,
    skip,
  } = getPagination(query);

  const {
    search,
    status,
    category,
    departmentId,
    sortBy,
    sortOrder,
    warrantyExpiring,
  } = query;

  const where = {
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        assetTag: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        serialNumber: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        make: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        model: {
          contains: search,
          mode: 'insensitive',
        },
      },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (category) {
    where.category = category;
  }

  if (departmentId) {
    where.departmentId = departmentId;
  }

  if (warrantyExpiring === true) {
    const now = new Date();

    const thirtyDaysOut = new Date(
      now.getTime()
      + 30 * 24 * 60 * 60 * 1000
    );

    where.warrantyExpiry = {
      gte: now,
      lte: thirtyDaysOut,
    };
  }

  const orderBy = buildOrderBy(
    sortBy,
    sortOrder,
    [
      'name',
      'assetTag',
      'createdAt',
      'category',
      'status',
      'warrantyExpiry',
    ]
  );

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      select: ASSET_LIST_SELECT,
      skip,
      take: limit,
      orderBy,
    }),

    prisma.asset.count({
      where,
    }),
  ]);

  return {
    assets,
    total,
    page,
    limit,
  };
}

async function getAssetById(id) {
  const asset = await prisma.asset.findUnique({
    where: {
      id,
      deletedAt: null,
    },

    select: ASSET_DETAIL_SELECT,
  });

  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  return asset;
}

async function createAsset(data) {
  const normalized = normalizeAssetData(data);

  const assetTag =
    normalized.assetTag || generateAssetTag();

  const createData = {
    ...normalized,
    assetTag,
    status: normalized.status || 'INACTIVE',
  };

  await assertUniqueAssetFields(createData);

  return prisma.asset.create({
    data: createData,
    select: ASSET_LIST_SELECT,
  });
}

async function updateAsset(id, data) {
  const asset = await prisma.asset.findUnique({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  const normalized = normalizeAssetData(data);

  await assertUniqueAssetFields(
    normalized,
    id
  );

  if (normalized.status) {
    const activeAssignment =
      await prisma.assetAssignment.findFirst({
        where: {
          assetId: id,
          isActive: true,
        },

        select: {
          id: true,
        },
      });

    if (
      normalized.status === 'ACTIVE'
      && !activeAssignment
    ) {
      throw new ConflictError(
        'Use the assignment endpoint to place an asset in use'
      );
    }

    if (
      activeAssignment
      && [
        'INACTIVE',
        'UNDER_MAINTENANCE',
        'DISPOSED',
      ].includes(normalized.status)
    ) {
      throw new ConflictError(
        'Return the assigned asset before changing it to this status'
      );
    }
  }

  return prisma.asset.update({
    where: {
      id,
    },

    data: normalized,
    select: ASSET_LIST_SELECT,
  });
}

async function deleteAsset(id) {
  const asset = await prisma.asset.findUnique({
    where: {
      id,
      deletedAt: null,
    },

    select: {
      id: true,
    },
  });

  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  const activeAssignment =
    await prisma.assetAssignment.findFirst({
      where: {
        assetId: id,
        isActive: true,
      },

      select: {
        id: true,
      },
    });

  if (activeAssignment) {
    throw new ConflictError(
      'Cannot delete an asset with an active assignment'
    );
  }

  await prisma.asset.update({
    where: {
      id,
    },

    data: {
      deletedAt: new Date(),
      status: 'DISPOSED',
    },
  });
}

async function assignAsset(
  assetId,
  userId,
  assignedById,
  notes
) {
  const [
    asset,
    user,
    existingAssignment,
  ] = await Promise.all([
    prisma.asset.findUnique({
      where: {
        id: assetId,
        deletedAt: null,
      },

      select: {
        id: true,
        assetTag: true,
        name: true,
        status: true,
      },
    }),

    prisma.user.findUnique({
      where: {
        id: userId,
        deletedAt: null,
        status: 'ACTIVE',
      },

      select: USER_SELECT,
    }),

    prisma.assetAssignment.findFirst({
      where: {
        assetId,
        isActive: true,
      },

      select: {
        id: true,
      },
    }),
  ]);

  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  if (!user) {
    throw new NotFoundError(
      'User not found or inactive'
    );
  }

  if (existingAssignment) {
    throw new ConflictError(
      'Asset is already assigned'
    );
  }

  if (asset.status !== 'INACTIVE') {
    throw new ConflictError(
      'Only an in-stock asset can be assigned'
    );
  }

  const result = await prisma.$transaction(
    async transaction => {
      /*
       * This conditional update prevents two concurrent requests
       * from assigning the same asset.
       */
      const claim =
        await transaction.asset.updateMany({
          where: {
            id: assetId,
            deletedAt: null,
            status: 'INACTIVE',
          },

          data: {
            status: 'ACTIVE',
          },
        });

      if (claim.count !== 1) {
        throw new ConflictError(
          'Asset is no longer available for assignment'
        );
      }

      const assignment =
        await transaction.assetAssignment.create({
          data: {
            assetId,
            userId,
            assignedById,
            notes,
            isActive: true,
          },

          select: ASSIGNMENT_SELECT,
        });

      const updatedAsset =
        await transaction.asset.findUnique({
          where: {
            id: assetId,
          },

          select: ASSET_DETAIL_SELECT,
        });

      return {
        asset: updatedAsset,
        assignment,
      };
    }
  );

  /*
   * Notification failures must not roll back an already completed
   * assignment, but the notification attempt is awaited so the
   * record exists before the API response is returned.
   */
  await notificationService
    .createNotification({
      userId,
      type: 'ASSET_ASSIGNED',
      title: 'Asset assigned',

      message:
        `${asset.assetTag} - ${asset.name} has been assigned to you`,

      data: {
        assetId,
        assetTag: asset.assetTag,
        assignedById,
      },
    })
    .catch(error => {
      logger.error(
        `Asset assignment notification failed: ${error.message}`
      );
    });

  return result;
}

async function returnAsset(assetId, notes) {
  const asset = await prisma.asset.findUnique({
    where: {
      id: assetId,
      deletedAt: null,
    },

    select: {
      id: true,
    },
  });

  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  const activeAssignment =
    await prisma.assetAssignment.findFirst({
      where: {
        assetId,
        isActive: true,
      },
    });

  if (!activeAssignment) {
    throw new ConflictError(
      'Asset is not currently assigned'
    );
  }

  return prisma.$transaction(
    async transaction => {
      const returnedAt = new Date();

      const returnResult =
        await transaction.assetAssignment.updateMany({
          where: {
            id: activeAssignment.id,
            isActive: true,
          },

          data: {
            isActive: false,
            returnedAt,
            notes:
              notes || activeAssignment.notes,
          },
        });

      if (returnResult.count !== 1) {
        throw new ConflictError(
          'Asset assignment was already returned'
        );
      }

      await transaction.asset.update({
        where: {
          id: assetId,
        },

        data: {
          status: 'INACTIVE',
        },
      });

      const [
        returnedAsset,
        returnedAssignment,
      ] = await Promise.all([
        transaction.asset.findUnique({
          where: {
            id: assetId,
          },

          select: ASSET_DETAIL_SELECT,
        }),

        transaction.assetAssignment.findUnique({
          where: {
            id: activeAssignment.id,
          },

          select: ASSIGNMENT_SELECT,
        }),
      ]);

      return {
        asset: returnedAsset,
        assignment: returnedAssignment,
      };
    }
  );
}

async function getAssetAssignmentHistory(assetId) {
  const asset = await prisma.asset.findUnique({
    where: {
      id: assetId,
      deletedAt: null,
    },

    select: {
      id: true,
    },
  });

  if (!asset) {
    throw new NotFoundError('Asset not found');
  }

  return prisma.assetAssignment.findMany({
    where: {
      assetId,
    },

    select: ASSIGNMENT_SELECT,

    orderBy: {
      assignedAt: 'desc',
    },
  });
}

async function getAssetStats() {
  const now = new Date();

  const thirtyDaysOut = new Date(
    now.getTime()
    + 30 * 24 * 60 * 60 * 1000
  );

  const [
    total,
    byStatus,
    byCategory,
    warrantyExpiring,
    activeAssignments,
  ] = await Promise.all([
    prisma.asset.count({
      where: {
        deletedAt: null,
      },
    }),

    prisma.asset.groupBy({
      by: ['status'],

      where: {
        deletedAt: null,
      },

      _count: {
        id: true,
      },
    }),

    prisma.asset.groupBy({
      by: ['category'],

      where: {
        deletedAt: null,
      },

      _count: {
        id: true,
      },
    }),

    prisma.asset.count({
      where: {
        deletedAt: null,

        warrantyExpiry: {
          gte: now,
          lte: thirtyDaysOut,
        },
      },
    }),

    prisma.assetAssignment.findMany({
      where: {
        isActive: true,

        asset: {
          deletedAt: null,
        },
      },

      distinct: ['assetId'],

      select: {
        assetId: true,
      },
    }),
  ]);

  const assigned = activeAssignments.length;

  return {
    total,
    assigned,
    unassigned: Math.max(
      0,
      total - assigned
    ),

    byStatus: Object.fromEntries(
      byStatus.map(item => [
        item.status,
        item._count.id,
      ])
    ),

    byCategory: Object.fromEntries(
      byCategory.map(item => [
        item.category,
        item._count.id,
      ])
    ),

    warrantyExpiringSoon:
      warrantyExpiring,
  };
}

module.exports = {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  getAssetAssignmentHistory,
  getAssetStats,
};