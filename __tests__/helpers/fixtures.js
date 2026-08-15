// __tests__/helpers/fixtures.js
const bcrypt = require('bcryptjs');

const {
  PERMISSIONS,
} = require('../../src/shared/constants');

const RESOURCE_DISPLAY_NAMES = {
  ticket: 'Ticket',
  user: 'User',
  asset: 'Asset',
  kb: 'Knowledge Base',
  analytics: 'Analytics',
  system: 'System',
};

function capitalize(value) {
  if (!value) {
    return '';
  }

  return (
    value.charAt(0).toUpperCase()
    + value.slice(1)
  );
}

function buildPermissionDefinition(name) {
  const [
    resourceName,
    ...actionParts
  ] = name.split(':');

  const displayResource =
    RESOURCE_DISPLAY_NAMES[resourceName]
    || capitalize(resourceName);

  const displayAction = actionParts
    .map(capitalize)
    .join(' ');

  return {
    name,
    displayName:
      `${displayResource} ${displayAction}`.trim(),

    resource:
      resourceName === 'kb'
        ? 'knowledge_base'
        : resourceName,

    action: actionParts.join(':'),
    description: name,
  };
}

/**
 * Creates all records required by the integration tests.
 */
async function seedTestData(prisma) {
  // ==========================================================
  // PERMISSIONS
  // ==========================================================

  const permissionDefinitions =
    Object.values(PERMISSIONS).map(
      buildPermissionDefinition
    );

  const permissions =
    await prisma.$transaction(
      permissionDefinitions.map(
        permission =>
          prisma.permission.upsert({
            where: {
              name: permission.name,
            },

            update: {
              displayName:
                permission.displayName,

              resource:
                permission.resource,

              action:
                permission.action,

              description:
                permission.description,
            },

            create: permission,
          })
      )
    );

  const permissionMap =
    Object.fromEntries(
      permissions.map(permission => [
        permission.name,
        permission,
      ])
    );

  // ==========================================================
  // ROLES
  // ==========================================================

  const superAdminRole =
    await prisma.role.upsert({
      where: {
        name: 'super_admin',
      },

      update: {
        displayName: 'Super Admin',
        isSystem: true,
      },

      create: {
        name: 'super_admin',
        displayName: 'Super Admin',
        description:
          'Full system access',
        isSystem: true,
      },
    });

  const technicianRole =
    await prisma.role.upsert({
      where: {
        name: 'it_technician',
      },

      update: {
        displayName: 'IT Technician',
        isSystem: true,
      },

      create: {
        name: 'it_technician',
        displayName: 'IT Technician',
        description:
          'Handle and resolve IT service tickets',
        isSystem: true,
      },
    });

  const endUserRole =
    await prisma.role.upsert({
      where: {
        name: 'end_user',
      },

      update: {
        displayName: 'End User',
        isSystem: true,
      },

      create: {
        name: 'end_user',
        displayName: 'End User',
        description:
          'Submit and track personal tickets',
        isSystem: true,
      },
    });

  // ==========================================================
  // SUPER-ADMIN PERMISSIONS
  // ==========================================================

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: superAdminRole.id,
    },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map(permission => ({
      roleId: superAdminRole.id,
      permissionId: permission.id,
    })),

    skipDuplicates: true,
  });

  // ==========================================================
  // TECHNICIAN PERMISSIONS
  // ==========================================================

  const technicianPermissionNames = [
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ_ALL,
    PERMISSIONS.TICKET_UPDATE_ALL,
    PERMISSIONS.TICKET_ASSIGN,
    PERMISSIONS.TICKET_CLOSE,
    PERMISSIONS.TICKET_ESCALATE,

    PERMISSIONS.USER_READ,

    PERMISSIONS.ASSET_READ,

    PERMISSIONS.KB_CREATE,
    PERMISSIONS.KB_READ,
    PERMISSIONS.KB_UPDATE,

    PERMISSIONS.ANALYTICS_READ,
  ];

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: technicianRole.id,
    },
  });

  await prisma.rolePermission.createMany({
    data: technicianPermissionNames.map(
      permissionName => ({
        roleId: technicianRole.id,

        permissionId:
          permissionMap[permissionName].id,
      })
    ),

    skipDuplicates: true,
  });

  // ==========================================================
  // END-USER PERMISSIONS
  // ==========================================================

  const endUserPermissionNames = [
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ_OWN,
    PERMISSIONS.TICKET_UPDATE_OWN,
    PERMISSIONS.KB_READ,
  ];

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: endUserRole.id,
    },
  });

  await prisma.rolePermission.createMany({
    data: endUserPermissionNames.map(
      permissionName => ({
        roleId: endUserRole.id,

        permissionId:
          permissionMap[permissionName].id,
      })
    ),

    skipDuplicates: true,
  });

  // ==========================================================
  // USERS
  // ==========================================================

  const password = await bcrypt.hash(
    'Test@1234!',
    10
  );

  const adminUser =
    await prisma.user.upsert({
      where: {
        email: 'admin@test.com',
      },

      update: {
        password,
        firstName: 'Admin',
        lastName: 'User',
        roleId: superAdminRole.id,
        status: 'ACTIVE',
        emailVerified: true,
        deletedAt: null,
      },

      create: {
        email: 'admin@test.com',
        password,
        firstName: 'Admin',
        lastName: 'User',
        roleId: superAdminRole.id,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

  const technicianUser =
    await prisma.user.upsert({
      where: {
        email: 'tech@test.com',
      },

      update: {
        password,
        firstName: 'Tech',
        lastName: 'User',
        roleId: technicianRole.id,
        status: 'ACTIVE',
        emailVerified: true,
        deletedAt: null,
      },

      create: {
        email: 'tech@test.com',
        password,
        firstName: 'Tech',
        lastName: 'User',
        roleId: technicianRole.id,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

  const endUser =
    await prisma.user.upsert({
      where: {
        email: 'user@test.com',
      },

      update: {
        password,
        firstName: 'End',
        lastName: 'User',
        roleId: endUserRole.id,
        status: 'ACTIVE',
        emailVerified: true,
        deletedAt: null,
      },

      create: {
        email: 'user@test.com',
        password,
        firstName: 'End',
        lastName: 'User',
        roleId: endUserRole.id,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

  // ==========================================================
  // SLA CONFIGURATIONS
  // ==========================================================

  const slaConfigurations = [
    {
      priority: 'P1_CRITICAL',
      responseTimeMinutes: 15,
      resolutionTimeMinutes: 240,
      warningThresholdPct: 80,
    },
    {
      priority: 'P2_HIGH',
      responseTimeMinutes: 60,
      resolutionTimeMinutes: 480,
      warningThresholdPct: 80,
    },
    {
      priority: 'P3_MEDIUM',
      responseTimeMinutes: 240,
      resolutionTimeMinutes: 1440,
      warningThresholdPct: 80,
    },
    {
      priority: 'P4_LOW',
      responseTimeMinutes: 480,
      resolutionTimeMinutes: 2880,
      warningThresholdPct: 80,
    },
  ];

  for (
    const configuration
    of slaConfigurations
  ) {
    await prisma.sLAConfiguration.upsert({
      where: {
        priority: configuration.priority,
      },

      update: configuration,
      create: configuration,
    });
  }

  return {
    adminUser,
    techUser: technicianUser,
    endUser,
    superAdminRole,
    techRole: technicianRole,
    endUserRole,
  };
}

/**
 * Removes integration-test data in dependency order.
 */
async function cleanTestData(prisma) {
  const tables = [
    'notification',
    'syncQueue',
    'auditLog',
    'articleRating',
    'knowledgeArticleTicket',
    'telemetryLog',
    'assetAssignment',
    'ticketHistory',
    'ticketAttachment',
    'ticketComment',
    'ticket',
    'knowledgeArticle',
    'asset',
    'device',
    'session',
    'emailVerificationToken',
    'passwordResetToken',
    'user',
    'rolePermission',
    'role',
    'permission',
    'sLAConfiguration',
    'routingRule',
  ];

  for (const table of tables) {
    if (
      prisma[table]
      && typeof prisma[table].deleteMany
        === 'function'
    ) {
      await prisma[table]
        .deleteMany({})
        .catch(() => {});
    }
  }
}

function makeTicketData(overrides = {}) {
  return {
    title:
      'Test ticket title with enough characters',

    description:
      'Test ticket description with enough characters to pass validation',

    category: 'HARDWARE_ISSUES',
    priority: 'P3_MEDIUM',

    ...overrides,
  };
}

module.exports = {
  seedTestData,
  cleanTestData,
  makeTicketData,
};