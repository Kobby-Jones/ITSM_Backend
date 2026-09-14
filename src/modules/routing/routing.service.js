// src/modules/routing/routing.service.js
const { prisma } = require('../../config/database');
const logger = require('../../config/logger');

/**
 * Rule-based automated ticket routing engine.
 *
 * Rules are evaluated in ascending priority order. Category/priority rules
 * accept both the legacy singular condition shape and the newer array shape:
 *   { category: 'NETWORK_CONNECTIVITY' }
 *   { categories: ['NETWORK_CONNECTIVITY', 'PRODUCTION_SYSTEMS'] }
 *
 * If no explicit rule matches, a workload-balancing fallback assigns the
 * least-loaded active technician, preferring the ticket/requester department.
 */
async function autoRouteTicket(ticket) {
  try {
    if (ticket.assigneeId) {
      return {
        routed: false,
        reason: 'already_assigned',
        assigneeId: ticket.assigneeId,
      };
    }

    const rules = await prisma.routingRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      const matched = await evaluateRule(rule, ticket);
      if (!matched) continue;

      const assigneeId = await resolveAssignee(rule, ticket);
      if (!assigneeId) continue;

      await applyAssignment({
        ticket,
        assigneeId,
        departmentId: rule.departmentId ?? ticket.departmentId,
        note: `Auto-routed by rule: ${rule.name}`,
      });

      logger.info(
        `Ticket ${ticket.ticketNumber} auto-routed by rule "${rule.name}" to user ${assigneeId}`
      );

      return {
        routed: true,
        strategy: 'rule',
        ruleId: rule.id,
        ruleName: rule.name,
        assigneeId,
      };
    }

    // A thesis/demo-safe default: if no explicit rule matches, still route the
    // ticket by current workload rather than leaving it unassigned forever.
    const fallbackAssignee =
      await findLeastLoadedTechnician(ticket.departmentId || null);

    if (fallbackAssignee) {
      await applyAssignment({
        ticket,
        assigneeId: fallbackAssignee,
        departmentId: ticket.departmentId,
        note: 'Auto-routed by workload balancing fallback',
      });

      logger.info(
        `Ticket ${ticket.ticketNumber} auto-routed by workload fallback to user ${fallbackAssignee}`
      );

      return {
        routed: true,
        strategy: 'workload_fallback',
        ruleId: null,
        ruleName: null,
        assigneeId: fallbackAssignee,
      };
    }

    logger.info(
      `Ticket ${ticket.ticketNumber} could not be auto-routed - no active technician available`
    );
    return {
      routed: false,
      reason: 'no_active_technician',
    };
  } catch (err) {
    logger.error(`Auto-routing failed for ticket ${ticket.id}:`, err.message);
    return { routed: false, error: err.message };
  }
}

async function applyAssignment({
  ticket,
  assigneeId,
  departmentId,
  note,
}) {
  await prisma.$transaction(async tx => {
    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        assigneeId,
        departmentId: departmentId ?? ticket.departmentId,
        status: 'ASSIGNED',
        assignedAt: new Date(),
        firstResponseAt: ticket.firstResponseAt ?? new Date(),
        lastActivityAt: new Date(),
      },
    });

    await tx.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        changedById: assigneeId,
        field: 'assigneeId',
        oldValue: ticket.assigneeId || null,
        newValue: assigneeId,
        action: 'ASSIGNED',
        note,
      },
    });
  });
}

async function evaluateRule(rule, ticket) {
  const conditions = rule.conditions || {};

  switch (rule.ruleType) {
    case 'CATEGORY_BASED': {
      if (Array.isArray(conditions.categories)) {
        return conditions.categories.includes(ticket.category);
      }
      return conditions.category === ticket.category;
    }

    case 'PRIORITY_BASED': {
      if (Array.isArray(conditions.priorities)) {
        return conditions.priorities.includes(ticket.priority);
      }
      return conditions.priority === ticket.priority;
    }

    case 'KEYWORD_BASED': {
      if (!Array.isArray(conditions.keywords) || !conditions.keywords.length) {
        return false;
      }
      const text = `${ticket.title || ''} ${ticket.description || ''}`.toLowerCase();
      return conditions.keywords.some(
        keyword => text.includes(String(keyword).toLowerCase())
      );
    }

    case 'DEPARTMENT_BASED':
      return Boolean(
        conditions.departmentId &&
        ticket.departmentId &&
        conditions.departmentId === ticket.departmentId
      );

    case 'WORKLOAD_BASED':
      return true;

    default:
      return false;
  }
}

async function resolveAssignee(rule, ticket) {
  // If a rule names a specific user, only use an active non-deleted account.
  if (rule.assignTo) {
    const user = await prisma.user.findFirst({
      where: {
        id: rule.assignTo,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    });
    return user ? user.id : null;
  }

  // Otherwise balance workload inside the rule/ticket department first.
  return findLeastLoadedTechnician(
    rule.departmentId || ticket.departmentId || null
  );
}

async function findLeastLoadedTechnician(departmentId) {
  const techRole = await prisma.role.findUnique({
    where: { name: 'it_technician' },
    select: { id: true },
  });
  if (!techRole) return null;

  const where = {
    roleId: techRole.id,
    status: 'ACTIVE',
    deletedAt: null,
  };
  if (departmentId) where.departmentId = departmentId;

  const technicians = await prisma.user.findMany({
    where,
    include: {
      _count: {
        select: {
          assignedTickets: {
            where: {
              status: { notIn: ['RESOLVED', 'CLOSED'] },
              deletedAt: null,
            },
          },
        },
      },
    },
  });

  if (!technicians.length) {
    // If the department has no technician, fall back to the global pool.
    if (departmentId) return findLeastLoadedTechnician(null);
    return null;
  }

  technicians.sort((a, b) => {
    const workloadDiff =
      a._count.assignedTickets - b._count.assignedTickets;
    if (workloadDiff !== 0) return workloadDiff;
    return a.id.localeCompare(b.id);
  });

  return technicians[0].id;
}

async function createRoutingRule(data) {
  return prisma.routingRule.create({ data });
}

async function getRoutingRules(query = {}) {
  const { isActive, ruleType } = query;
  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (ruleType) where.ruleType = ruleType;

  return prisma.routingRule.findMany({
    where,
    orderBy: { priority: 'asc' },
  });
}

async function updateRoutingRule(id, data) {
  const rule = await prisma.routingRule.findUnique({ where: { id } });
  if (!rule) throw new Error('Routing rule not found');
  return prisma.routingRule.update({ where: { id }, data });
}

async function deleteRoutingRule(id) {
  await prisma.routingRule.delete({ where: { id } });
}

async function testRoutingRule(ruleId, ticketData) {
  const rule = await prisma.routingRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new Error('Rule not found');

  const matched = await evaluateRule(rule, ticketData);
  let assigneeId = null;
  if (matched) assigneeId = await resolveAssignee(rule, ticketData);

  return {
    ruleId,
    ruleName: rule.name,
    matched,
    wouldAssignTo: assigneeId,
  };
}

module.exports = {
  autoRouteTicket,
  createRoutingRule,
  getRoutingRules,
  updateRoutingRule,
  deleteRoutingRule,
  testRoutingRule,
  findLeastLoadedTechnician,
  evaluateRule,
};
