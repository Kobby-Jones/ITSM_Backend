// src/modules/routing/routing.service.js
const { prisma } = require('../../config/database');
const logger = require('../../config/logger');

/**
 * Rule-based automated ticket routing engine.
 * Evaluates routing rules in priority order and assigns tickets
 * based on category, priority, keywords, department, and workload.
 */

async function autoRouteTicket(ticket) {
  try {
    const rules = await prisma.routingRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      const matched = await evaluateRule(rule, ticket);
      if (matched) {
        const assigneeId = await resolveAssignee(rule, ticket);
        if (assigneeId) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              assigneeId,
              departmentId: rule.departmentId ?? ticket.departmentId,
              status: 'ASSIGNED',
              assignedAt: new Date(),
              firstResponseAt: ticket.firstResponseAt ?? new Date(),
              lastActivityAt: new Date(),
            },
          });

          await prisma.ticketHistory.create({
            data: {
              ticketId: ticket.id,
              changedById: assigneeId,
              field: 'assigneeId',
              oldValue: null,
              newValue: assigneeId,
              action: 'ASSIGNED',
              note: `Auto-routed by rule: ${rule.name}`,
            },
          });

          logger.info(`Ticket ${ticket.ticketNumber} auto-routed by rule "${rule.name}" to user ${assigneeId}`);
          return { routed: true, ruleId: rule.id, assigneeId };
        }
      }
    }

    logger.info(`Ticket ${ticket.ticketNumber} could not be auto-routed - no matching rule`);
    return { routed: false };
  } catch (err) {
    logger.error(`Auto-routing failed for ticket ${ticket.id}:`, err.message);
    return { routed: false, error: err.message };
  }
}

async function evaluateRule(rule, ticket) {
  const conditions = rule.conditions;

  switch (rule.ruleType) {
    case 'CATEGORY_BASED':
      return conditions.category === ticket.category;

    case 'PRIORITY_BASED':
      if (Array.isArray(conditions.priorities)) return conditions.priorities.includes(ticket.priority);
      return conditions.priority === ticket.priority;

    case 'KEYWORD_BASED':
      if (!conditions.keywords?.length) return false;
      const text = `${ticket.title} ${ticket.description}`.toLowerCase();
      return conditions.keywords.some(kw => text.includes(kw.toLowerCase()));

    case 'DEPARTMENT_BASED':
      return conditions.departmentId === ticket.departmentId;

    case 'WORKLOAD_BASED':
      // Always matches - assignment handled by workload balancing
      return true;

    default:
      return false;
  }
}

async function resolveAssignee(rule, ticket) {
  // If rule specifies a specific user
  if (rule.assignTo) {
    const user = await prisma.user.findUnique({
      where: { id: rule.assignTo, status: 'ACTIVE', deletedAt: null },
    });
    return user ? user.id : null;
  }

  // Otherwise find least-loaded technician in the department
  return findLeastLoadedTechnician(rule.departmentId || ticket.departmentId);
}

async function findLeastLoadedTechnician(departmentId) {
  const techRole = await prisma.role.findUnique({ where: { name: 'it_technician' } });
  if (!techRole) return null;

  const where = { roleId: techRole.id, status: 'ACTIVE', deletedAt: null };
  if (departmentId) where.departmentId = departmentId;

  const technicians = await prisma.user.findMany({
    where,
    include: {
      _count: {
        select: {
          assignedTickets: {
            where: { status: { notIn: ['RESOLVED', 'CLOSED'] }, deletedAt: null },
          },
        },
      },
    },
  });

  if (!technicians.length) {
    // Try without department filter
    if (departmentId) return findLeastLoadedTechnician(null);
    return null;
  }

  // Sort by active ticket count (workload balancing)
  technicians.sort((a, b) => a._count.assignedTickets - b._count.assignedTickets);
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

  return { ruleId, ruleName: rule.name, matched, wouldAssignTo: assigneeId };
}

module.exports = {
  autoRouteTicket, createRoutingRule, getRoutingRules,
  updateRoutingRule, deleteRoutingRule, testRoutingRule,
  findLeastLoadedTechnician,
};
