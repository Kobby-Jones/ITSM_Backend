// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ROLES = [
  { name: 'super_admin', displayName: 'Super Admin', description: 'Full system access', isSystem: true },
  { name: 'it_manager', displayName: 'IT Manager', description: 'Manage IT operations and reporting', isSystem: true },
  { name: 'it_admin', displayName: 'IT Administrator', description: 'Manage system configuration', isSystem: true },
  { name: 'it_technician', displayName: 'IT Technician', description: 'Handle and resolve tickets', isSystem: true },
  { name: 'end_user', displayName: 'End User', description: 'Submit and track own tickets', isSystem: true },
];

const PERMISSIONS = [
  // Ticket permissions
  { name: 'ticket:create', displayName: 'Create Tickets', resource: 'ticket', action: 'create' },
  { name: 'ticket:read:own', displayName: 'Read Own Tickets', resource: 'ticket', action: 'read:own' },
  { name: 'ticket:read:all', displayName: 'Read All Tickets', resource: 'ticket', action: 'read:all' },
  { name: 'ticket:update:own', displayName: 'Update Own Tickets', resource: 'ticket', action: 'update:own' },
  { name: 'ticket:update:all', displayName: 'Update All Tickets', resource: 'ticket', action: 'update:all' },
  { name: 'ticket:delete', displayName: 'Delete Tickets', resource: 'ticket', action: 'delete' },
  { name: 'ticket:assign', displayName: 'Assign Tickets', resource: 'ticket', action: 'assign' },
  { name: 'ticket:escalate', displayName: 'Escalate Tickets', resource: 'ticket', action: 'escalate' },
  { name: 'ticket:close', displayName: 'Close Tickets', resource: 'ticket', action: 'close' },
  // User permissions
  { name: 'user:create', displayName: 'Create Users', resource: 'user', action: 'create' },
  { name: 'user:read', displayName: 'Read Users', resource: 'user', action: 'read' },
  { name: 'user:update', displayName: 'Update Users', resource: 'user', action: 'update' },
  { name: 'user:delete', displayName: 'Delete Users', resource: 'user', action: 'delete' },
  { name: 'user:manage:roles', displayName: 'Manage User Roles', resource: 'user', action: 'manage:roles' },
  // Asset permissions
  { name: 'asset:create', displayName: 'Create Assets', resource: 'asset', action: 'create' },
  { name: 'asset:read', displayName: 'Read Assets', resource: 'asset', action: 'read' },
  { name: 'asset:update', displayName: 'Update Assets', resource: 'asset', action: 'update' },
  { name: 'asset:delete', displayName: 'Delete Assets', resource: 'asset', action: 'delete' },
  { name: 'asset:assign', displayName: 'Assign Assets', resource: 'asset', action: 'assign' },
  // Knowledge base permissions
  { name: 'kb:create', displayName: 'Create KB Articles', resource: 'knowledge_base', action: 'create' },
  { name: 'kb:read', displayName: 'Read KB Articles', resource: 'knowledge_base', action: 'read' },
  { name: 'kb:update', displayName: 'Update KB Articles', resource: 'knowledge_base', action: 'update' },
  { name: 'kb:delete', displayName: 'Delete KB Articles', resource: 'knowledge_base', action: 'delete' },
  { name: 'kb:publish', displayName: 'Publish KB Articles', resource: 'knowledge_base', action: 'publish' },
  // Analytics permissions
  { name: 'analytics:read', displayName: 'Read Analytics', resource: 'analytics', action: 'read' },
  { name: 'analytics:export', displayName: 'Export Analytics', resource: 'analytics', action: 'export' },
  // System permissions
  { name: 'system:config', displayName: 'Configure System', resource: 'system', action: 'config' },
  { name: 'system:audit', displayName: 'View Audit Logs', resource: 'system', action: 'audit' },
  { name: 'system:routing', displayName: 'Manage Routing Rules', resource: 'system', action: 'routing' },
  { name: 'system:sla', displayName: 'Manage SLA Config', resource: 'system', action: 'sla' },
];

const ROLE_PERMISSIONS = {
  super_admin: PERMISSIONS.map(p => p.name),
  it_manager: [
    'ticket:read:all', 'ticket:update:all', 'ticket:assign', 'ticket:escalate', 'ticket:close',
    'user:read', 'asset:read', 'kb:read', 'kb:create', 'kb:update', 'kb:publish',
    'analytics:read', 'analytics:export', 'system:audit', 'system:sla', 'system:routing',
  ],
  it_admin: [
    'ticket:read:all', 'ticket:update:all', 'ticket:assign', 'ticket:escalate', 'ticket:close',
    'user:create', 'user:read', 'user:update',
    'asset:create', 'asset:read', 'asset:update', 'asset:assign',
    'kb:create', 'kb:read', 'kb:update', 'kb:publish',
    'analytics:read', 'system:config', 'system:routing', 'system:sla',
  ],
  it_technician: [
    'ticket:create', 'ticket:read:all', 'ticket:update:all', 'ticket:close',
    'asset:read', 'kb:create', 'kb:read', 'kb:update',
    'analytics:read',
  ],
  end_user: [
    'ticket:create', 'ticket:read:own', 'ticket:update:own',
    'kb:read',
  ],
};

const SLA_CONFIGS = [
  { priority: 'P1_CRITICAL', responseTimeMinutes: 15, resolutionTimeMinutes: 240 },
  { priority: 'P2_HIGH', responseTimeMinutes: 60, resolutionTimeMinutes: 480 },
  { priority: 'P3_MEDIUM', responseTimeMinutes: 240, resolutionTimeMinutes: 1440 },
  { priority: 'P4_LOW', responseTimeMinutes: 480, resolutionTimeMinutes: 4320 },
];

async function main() {
  console.log('🌱 Starting database seed...');

  // Create roles
  console.log('Creating roles...');
  const roleMap = {};
  for (const role of ROLES) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: { displayName: role.displayName, description: role.description },
      create: role,
    });
    roleMap[role.name] = created;
  }

  // Create permissions
  console.log('Creating permissions...');
  const permissionMap = {};
  for (const perm of PERMISSIONS) {
    const created = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
    permissionMap[perm.name] = created;
  }

  // Assign role permissions
  console.log('Assigning role permissions...');
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleMap[roleName];
    for (const permName of permNames) {
      const perm = permissionMap[permName];
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // Create default department
  console.log('Creating departments...');
  const itDept = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: { name: 'Information Technology', code: 'IT', description: 'IT Department' },
  });

  await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: { name: 'Human Resources', code: 'HR', description: 'HR Department' },
  });

  await prisma.department.upsert({
    where: { code: 'FIN' },
    update: {},
    create: { name: 'Finance', code: 'FIN', description: 'Finance Department' },
  });

  // Create super admin user
  console.log('Creating super admin user...');
  const hashedPassword = await bcrypt.hash('SuperAdmin@2024!', 12);
  await prisma.user.upsert({
    where: { email: 'superadmin@itsm.com' },
    update: {},
    create: {
      email: 'superadmin@itsm.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      employeeId: 'EMP-001',
      status: 'ACTIVE',
      emailVerified: true,
      roleId: roleMap['super_admin'].id,
      departmentId: itDept.id,
    },
  });

  // Create demo technician
  const techPassword = await bcrypt.hash('Technician@2024!', 12);
  await prisma.user.upsert({
    where: { email: 'technician@itsm.com' },
    update: {},
    create: {
      email: 'technician@itsm.com',
      password: techPassword,
      firstName: 'John',
      lastName: 'Doe',
      employeeId: 'EMP-002',
      status: 'ACTIVE',
      emailVerified: true,
      roleId: roleMap['it_technician'].id,
      departmentId: itDept.id,
    },
  });

  // Create demo end user
  const userPassword = await bcrypt.hash('EndUser@2024!', 12);
  await prisma.user.upsert({
    where: { email: 'user@itsm.com' },
    update: {},
    create: {
      email: 'user@itsm.com',
      password: userPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      employeeId: 'EMP-003',
      status: 'ACTIVE',
      emailVerified: true,
      roleId: roleMap['end_user'].id,
    },
  });

  // Create SLA configurations
  console.log('Creating SLA configurations...');
  for (const sla of SLA_CONFIGS) {
    await prisma.sLAConfiguration.upsert({
      where: { priority: sla.priority },
      update: { responseTimeMinutes: sla.responseTimeMinutes, resolutionTimeMinutes: sla.resolutionTimeMinutes },
      create: sla,
    });
  }

  // Create default routing rules
  console.log('Creating default routing rules...');
  await prisma.routingRule.createMany({
    data: [
      {
        name: 'Network Issues → Network Team',
        ruleType: 'CATEGORY_BASED',
        priority: 10,
        isActive: true,
        conditions: { category: 'NETWORK_CONNECTIVITY' },
        departmentId: itDept.id,
      },
      {
        name: 'P1 Critical Auto-Escalate',
        ruleType: 'PRIORITY_BASED',
        priority: 1,
        isActive: true,
        conditions: { priority: 'P1_CRITICAL' },
        departmentId: itDept.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Database seeded successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('Super Admin: superadmin@itsm.com / SuperAdmin@2024!');
  console.log('Technician:  technician@itsm.com / Technician@2024!');
  console.log('End User:    user@itsm.com / EndUser@2024!');
}

main()
  .catch(e => { console.error('Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
