// __tests__/helpers/fixtures.js
const bcrypt = require('bcryptjs');

/**
 * Returns seeded test data for use in integration tests.
 * Call prisma.$transaction with these to create a clean state.
 */
async function seedTestData(prisma) {
  // Create permissions
  const permissions = await prisma.$transaction(
    ['ticket:create', 'ticket:read:own', 'ticket:read:all', 'ticket:update:own',
     'ticket:update:all', 'ticket:assign', 'ticket:close', 'ticket:escalate',
     'user:read', 'user:update', 'user:delete', 'user:manage_roles',
     'asset:read', 'asset:create', 'asset:update', 'asset:delete', 'asset:assign',
     'knowledge_base:read', 'knowledge_base:create', 'knowledge_base:update', 'knowledge_base:delete', 'knowledge_base:publish',
     'analytics:read', 'analytics:export',
     'system:config', 'system:audit', 'system:sla', 'system:routing',
    ].map(name => prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, resource: name.split(':')[0], action: name.split(':').slice(1).join(':'), description: name },
    }))
  );

  const permMap = Object.fromEntries(permissions.map(p => [p.name, p]));

  // Create roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: {},
    create: { name: 'super_admin', displayName: 'Super Admin', isSystem: true },
  });

  const techRole = await prisma.role.upsert({
    where: { name: 'it_technician' },
    update: {},
    create: { name: 'it_technician', displayName: 'IT Technician', isSystem: true },
  });

  const endUserRole = await prisma.role.upsert({
    where: { name: 'end_user' },
    update: {},
    create: { name: 'end_user', displayName: 'End User', isSystem: true },
  });

  // Assign all permissions to super_admin
  const allPerms = Object.values(permMap);
  await prisma.rolePermission.deleteMany({ where: { roleId: superAdminRole.id } });
  await prisma.rolePermission.createMany({
    data: allPerms.map(p => ({ roleId: superAdminRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // Assign limited perms to technician
  const techPermNames = ['ticket:read:all', 'ticket:update:all', 'ticket:assign', 'ticket:close',
    'ticket:escalate', 'user:read', 'asset:read', 'knowledge_base:read'];
  await prisma.rolePermission.deleteMany({ where: { roleId: techRole.id } });
  await prisma.rolePermission.createMany({
    data: techPermNames.map(n => ({ roleId: techRole.id, permissionId: permMap[n].id })),
    skipDuplicates: true,
  });

  // End user perms
  const endUserPermNames = ['ticket:create', 'ticket:read:own', 'ticket:update:own', 'knowledge_base:read'];
  await prisma.rolePermission.deleteMany({ where: { roleId: endUserRole.id } });
  await prisma.rolePermission.createMany({
    data: endUserPermNames.map(n => ({ roleId: endUserRole.id, permissionId: permMap[n].id })),
    skipDuplicates: true,
  });

  const password = await bcrypt.hash('Test@1234!', 10);

  // Create test users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com', password, firstName: 'Admin', lastName: 'User',
      roleId: superAdminRole.id, status: 'ACTIVE', emailVerified: true,
    },
  });

  const techUser = await prisma.user.upsert({
    where: { email: 'tech@test.com' },
    update: {},
    create: {
      email: 'tech@test.com', password, firstName: 'Tech', lastName: 'User',
      roleId: techRole.id, status: 'ACTIVE', emailVerified: true,
    },
  });

  const endUser = await prisma.user.upsert({
    where: { email: 'user@test.com' },
    update: {},
    create: {
      email: 'user@test.com', password, firstName: 'End', lastName: 'User',
      roleId: endUserRole.id, status: 'ACTIVE', emailVerified: true,
    },
  });

  // Create SLA configs
  const slaPriorities = [
    { priority: 'P1_CRITICAL', responseTimeMinutes: 15, resolutionTimeMinutes: 240, warningThresholdPct: 80 },
    { priority: 'P2_HIGH', responseTimeMinutes: 60, resolutionTimeMinutes: 480, warningThresholdPct: 80 },
    { priority: 'P3_MEDIUM', responseTimeMinutes: 240, resolutionTimeMinutes: 1440, warningThresholdPct: 80 },
    { priority: 'P4_LOW', responseTimeMinutes: 480, resolutionTimeMinutes: 2880, warningThresholdPct: 80 },
  ];

  for (const sla of slaPriorities) {
    await prisma.sLAConfiguration.upsert({ where: { priority: sla.priority }, update: sla, create: sla });
  }

  return { adminUser, techUser, endUser, superAdminRole, techRole, endUserRole };
}

async function cleanTestData(prisma) {
  // Delete in dependency order
  const tables = [
    'notification', 'syncQueue', 'auditLog', 'articleRating', 'knowledgeArticleTicket',
    'telemetryLog', 'assetAssignment', 'ticketHistory', 'ticketAttachment', 'ticketComment',
    'ticket', 'knowledgeArticle', 'asset', 'device', 'session',
    'emailVerificationToken', 'passwordResetToken',
    'user', 'rolePermission', 'role', 'permission', 'sLAConfiguration', 'routingRule',
  ];

  for (const table of tables) {
    await prisma[table].deleteMany({}).catch(() => {});
  }
}

function makeTicketData(overrides = {}) {
  return {
    title: 'Test ticket title with enough characters',
    description: 'Test ticket description with enough characters to pass validation',
    category: 'HARDWARE_ISSUES',
    priority: 'P3_MEDIUM',
    ...overrides,
  };
}

module.exports = { seedTestData, cleanTestData, makeTicketData };
