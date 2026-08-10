// src/modules/analytics/analytics.service.js
const { prisma } = require('../../config/database');
const { cacheGet, cacheSet } = require('../../config/redis');
const { CACHE_KEYS } = require('../../shared/constants');

async function getDashboardKPIs(userId, userRole) {
  const cacheKey = CACHE_KEYS.DASHBOARD(userId);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const isAdmin = ['super_admin', 'it_admin', 'it_manager', 'it_technician'].includes(userRole);
  const ticketWhere = isAdmin ? { deletedAt: null } : { creatorId: userId, deletedAt: null };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    totalTickets, openTickets, resolvedTickets, closedTickets, escalatedTickets,
    slaBreached, thisMonthTickets, lastMonthTickets,
    p1Tickets, p2Tickets, byCategory, byStatus,
    avgResolutionTime, activeAssets, totalUsers,
  ] = await Promise.all([
    prisma.ticket.count({ where: ticketWhere }),
    prisma.ticket.count({ where: { ...ticketWhere, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING'] } } }),
    prisma.ticket.count({ where: { ...ticketWhere, status: 'RESOLVED' } }),
    prisma.ticket.count({ where: { ...ticketWhere, status: 'CLOSED' } }),
    prisma.ticket.count({ where: { ...ticketWhere, status: 'ESCALATED' } }),
    prisma.ticket.count({ where: { ...ticketWhere, slaBreached: true } }),
    prisma.ticket.count({ where: { ...ticketWhere, createdAt: { gte: startOfMonth } } }),
    prisma.ticket.count({ where: { ...ticketWhere, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    prisma.ticket.count({ where: { ...ticketWhere, priority: 'P1_CRITICAL', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    prisma.ticket.count({ where: { ...ticketWhere, priority: 'P2_HIGH', status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    prisma.ticket.groupBy({ by: ['category'], where: ticketWhere, _count: { id: true } }),
    prisma.ticket.groupBy({ by: ['status'], where: ticketWhere, _count: { id: true } }),
    isAdmin ? prisma.ticket.aggregate({
      where: { ...ticketWhere, resolvedAt: { not: null } },
      _avg: {}, // Computed below
    }) : Promise.resolve(null),
    isAdmin ? prisma.asset.count({ where: { status: 'ACTIVE', deletedAt: null } }) : Promise.resolve(null),
    isAdmin ? prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }) : Promise.resolve(null),
  ]);

  // Calculate average resolution time manually
  let avgResolutionMinutes = null;
  if (isAdmin) {
    const resolved = await prisma.ticket.findMany({
      where: { deletedAt: null, resolvedAt: { not: null } },
      select: { openedAt: true, resolvedAt: true },
      take: 1000,
      orderBy: { resolvedAt: 'desc' },
    });
    if (resolved.length > 0) {
      const totalMinutes = resolved.reduce((sum, t) => {
        return sum + (new Date(t.resolvedAt) - new Date(t.openedAt)) / 60000;
      }, 0);
      avgResolutionMinutes = Math.round(totalMinutes / resolved.length);
    }
  }

  const monthGrowth = lastMonthTickets > 0
    ? (((thisMonthTickets - lastMonthTickets) / lastMonthTickets) * 100).toFixed(1)
    : null;

  const slaComplianceRate = totalTickets > 0
    ? (((totalTickets - slaBreached) / totalTickets) * 100).toFixed(1)
    : 100;

  const kpis = {
    tickets: {
      total: totalTickets,
      open: openTickets,
      resolved: resolvedTickets,
      closed: closedTickets,
      escalated: escalatedTickets,
      thisMonth: thisMonthTickets,
      monthGrowth: monthGrowth ? parseFloat(monthGrowth) : null,
      criticalOpen: p1Tickets + p2Tickets,
    },
    sla: {
      breached: slaBreached,
      complianceRate: parseFloat(slaComplianceRate),
    },
    performance: {
      avgResolutionMinutes,
      avgResolutionHours: avgResolutionMinutes ? Math.round(avgResolutionMinutes / 60) : null,
    },
    byCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count.id])),
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count.id])),
    ...(isAdmin ? { totalUsers, activeAssets } : {}),
  };

  await cacheSet(cacheKey, kpis, parseInt(process.env.DASHBOARD_CACHE_TTL) || 60);
  return kpis;
}

async function getTicketTrends(query) {
  const { from, to, groupBy = 'day' } = query;
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = to ? new Date(to) : new Date();

  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate }, deletedAt: null },
    select: { createdAt: true, status: true, priority: true, category: true, slaBreached: true },
  });

  const grouped = {};
  for (const t of tickets) {
    let key;
    const d = new Date(t.createdAt);
    if (groupBy === 'month') key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    else if (groupBy === 'week') {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = d.toISOString().split('T')[0];
    }

    if (!grouped[key]) grouped[key] = { date: key, total: 0, resolved: 0, breached: 0 };
    grouped[key].total++;
    if (t.status === 'RESOLVED' || t.status === 'CLOSED') grouped[key].resolved++;
    if (t.slaBreached) grouped[key].breached++;
  }

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

async function getTechnicianPerformance(query) {
  const { from, to } = query;
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = to ? new Date(to) : new Date();

  const techRole = await prisma.role.findUnique({ where: { name: 'it_technician' } });
  if (!techRole) return [];

  const technicians = await prisma.user.findMany({
    where: { roleId: techRole.id, status: 'ACTIVE', deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true,
      assignedTickets: {
        where: { deletedAt: null, assignedAt: { gte: fromDate, lte: toDate } },
        select: { status: true, slaBreached: true, resolvedAt: true, openedAt: true },
      },
    },
  });

  return technicians.map(tech => {
    const tickets = tech.assignedTickets;
    const resolved = tickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status));
    const breached = tickets.filter(t => t.slaBreached);

    let avgResolutionMinutes = null;
    if (resolved.length > 0) {
      const total = resolved.reduce((sum, t) => {
        if (!t.resolvedAt) return sum;
        return sum + (new Date(t.resolvedAt) - new Date(t.openedAt)) / 60000;
      }, 0);
      avgResolutionMinutes = Math.round(total / resolved.filter(t => t.resolvedAt).length);
    }

    return {
      id: tech.id,
      name: `${tech.firstName} ${tech.lastName}`,
      totalAssigned: tickets.length,
      resolved: resolved.length,
      slaBreached: breached.length,
      resolutionRate: tickets.length > 0 ? ((resolved.length / tickets.length) * 100).toFixed(1) : 0,
      avgResolutionMinutes,
    };
  });
}

async function getResolutionTimeReport(query) {
  const { from, to, priority } = query;
  const where = { deletedAt: null, resolvedAt: { not: null } };
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = new Date(from);
  if (to) where.createdAt.lte = new Date(to);
  if (priority) where.priority = priority;

  const tickets = await prisma.ticket.findMany({
    where,
    select: { priority: true, category: true, openedAt: true, resolvedAt: true, slaResolutionDue: true },
  });

  const byPriority = {};
  for (const t of tickets) {
    if (!byPriority[t.priority]) byPriority[t.priority] = [];
    const minutes = (new Date(t.resolvedAt) - new Date(t.openedAt)) / 60000;
    byPriority[t.priority].push(minutes);
  }

  return Object.entries(byPriority).map(([priority, times]) => ({
    priority,
    count: times.length,
    avgMinutes: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    minMinutes: Math.round(Math.min(...times)),
    maxMinutes: Math.round(Math.max(...times)),
  }));
}

async function getCategoryBreakdown(query) {
  const { from, to } = query;
  const where = { deletedAt: null };
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = new Date(from);
  if (to) where.createdAt.lte = new Date(to);

  const [byCategory, byCategoryResolved] = await Promise.all([
    prisma.ticket.groupBy({ by: ['category'], where, _count: { id: true } }),
    prisma.ticket.groupBy({
      by: ['category'],
      where: { ...where, status: { in: ['RESOLVED', 'CLOSED'] } },
      _count: { id: true },
    }),
  ]);

  const resolvedMap = Object.fromEntries(byCategoryResolved.map(c => [c.category, c._count.id]));

  return byCategory.map(c => ({
    category: c.category,
    total: c._count.id,
    resolved: resolvedMap[c.category] || 0,
    resolutionRate: c._count.id > 0 ? (((resolvedMap[c.category] || 0) / c._count.id) * 100).toFixed(1) : 0,
  }));
}

module.exports = { getDashboardKPIs, getTicketTrends, getTechnicianPerformance, getResolutionTimeReport, getCategoryBreakdown };
