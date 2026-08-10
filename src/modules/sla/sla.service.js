// src/modules/sla/sla.service.js
const { prisma } = require('../../config/database');
const { addMinutes, minutesDiff, formatDuration } = require('../../utils/helpers');
const notificationService = require('../notifications/notifications.service');
const logger = require('../../config/logger');

async function getSLAConfigurations() {
  return prisma.sLAConfiguration.findMany({ orderBy: { priority: 'asc' } });
}

async function updateSLAConfiguration(priority, data) {
  return prisma.sLAConfiguration.upsert({
    where: { priority },
    update: data,
    create: { priority, ...data },
  });
}

async function getSLAStatus(ticket) {
  const now = new Date();
  const slaConfig = await prisma.sLAConfiguration.findUnique({ where: { priority: ticket.priority } });

  if (!slaConfig) return null;

  const responseStatus = ticket.slaResponseDue ? {
    due: ticket.slaResponseDue,
    met: ticket.firstResponseAt ? ticket.firstResponseAt <= ticket.slaResponseDue : null,
    breached: !ticket.firstResponseAt && now > ticket.slaResponseDue,
    timeRemainingMinutes: ticket.firstResponseAt ? null : minutesDiff(now, ticket.slaResponseDue),
  } : null;

  const resolutionStatus = ticket.slaResolutionDue ? {
    due: ticket.slaResolutionDue,
    met: ticket.resolvedAt ? ticket.resolvedAt <= ticket.slaResolutionDue : null,
    breached: !ticket.resolvedAt && now > ticket.slaResolutionDue,
    timeRemainingMinutes: ticket.resolvedAt ? null : minutesDiff(now, ticket.slaResolutionDue),
  } : null;

  const warningThreshold = slaConfig.warningThresholdPct / 100;
  let warningActive = false;

  if (resolutionStatus && !resolutionStatus.met && !resolutionStatus.breached) {
    const totalMinutes = slaConfig.resolutionTimeMinutes;
    const elapsedMinutes = minutesDiff(new Date(ticket.openedAt), now);
    warningActive = elapsedMinutes / totalMinutes >= warningThreshold;
  }

  return { response: responseStatus, resolution: resolutionStatus, warningActive };
}

/**
 * Called by cron job every 5 minutes.
 * Detects SLA breaches and sends warnings.
 */
async function checkSLABreaches() {
  logger.info('Running SLA breach check...');

  const now = new Date();
  const activeStatuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ESCALATED'];

  // Find tickets approaching or past SLA resolution due
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: activeStatuses },
      slaResolutionDue: { not: null },
      deletedAt: null,
    },
    include: {
      assignee: { select: { id: true, email: true, firstName: true, fcmToken: true } },
      creator: { select: { id: true, email: true, firstName: true, fcmToken: true } },
    },
  });

  let breachedCount = 0;
  let warnedCount = 0;

  for (const ticket of tickets) {
    const slaConfig = await prisma.sLAConfiguration.findUnique({ where: { priority: ticket.priority } });
    if (!slaConfig) continue;

    const isBreached = now > ticket.slaResolutionDue;
    const warningThreshold = slaConfig.warningThresholdPct / 100;
    const totalMs = slaConfig.resolutionTimeMinutes * 60 * 1000;
    const elapsedMs = now - new Date(ticket.openedAt);
    const isWarning = !isBreached && elapsedMs / totalMs >= warningThreshold;

    if (isBreached && !ticket.slaBreached) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { slaBreached: true, slaResolutionMet: false },
      });

      // Notify assignee and escalate
      if (ticket.assigneeId) {
        await notificationService.sendSLANotification('SLA_BREACH', ticket, ticket.assignee).catch(() => {});
      }
      await notificationService.sendSLANotification('SLA_BREACH', ticket, ticket.creator).catch(() => {});

      // Auto-escalate P1/P2 breaches
      if (['P1_CRITICAL', 'P2_HIGH'].includes(ticket.priority)) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: 'ESCALATED', escalatedAt: now },
        }).catch(() => {});
      }

      breachedCount++;
    } else if (isWarning) {
      if (ticket.assigneeId) {
        await notificationService.sendSLANotification('SLA_WARNING', ticket, ticket.assignee).catch(() => {});
      }
      warnedCount++;
    }
  }

  logger.info(`SLA check complete: ${breachedCount} breaches, ${warnedCount} warnings`);
  return { breachedCount, warnedCount };
}

async function getSLAReport(from, to) {
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const where = { deletedAt: null };
  if (from || to) where.createdAt = dateFilter;

  const [totalTickets, breachedTickets, resolvedOnTime, byPriority] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, slaBreached: true } }),
    prisma.ticket.count({ where: { ...where, slaResolutionMet: true } }),
    prisma.ticket.groupBy({
      by: ['priority'],
      where,
      _count: { id: true },
      _sum: { slaBreached: true },
    }),
  ]);

  const complianceRate = totalTickets > 0 ? ((totalTickets - breachedTickets) / totalTickets * 100).toFixed(2) : 100;

  return {
    summary: { totalTickets, breachedTickets, resolvedOnTime, complianceRate: parseFloat(complianceRate) },
    byPriority: byPriority.map(p => ({
      priority: p.priority,
      total: p._count.id,
      breached: p._sum.slaBreached || 0,
      complianceRate: p._count.id > 0
        ? (((p._count.id - (p._sum.slaBreached || 0)) / p._count.id) * 100).toFixed(2)
        : 100,
    })),
  };
}

module.exports = { getSLAConfigurations, updateSLAConfiguration, getSLAStatus, checkSLABreaches, getSLAReport };
