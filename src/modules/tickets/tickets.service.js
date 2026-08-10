// src/modules/tickets/tickets.service.js
const { prisma } = require('../../config/database');
const { NotFoundError, AppError, AuthorizationError } = require('../../shared/errors');
const { getPagination, buildOrderBy, generateTicketNumber, addMinutes } = require('../../utils/helpers');
const { TICKET_STATUS, PERMISSIONS } = require('../../shared/constants');
const routingEngine = require('../routing/routing.service');
const notificationService = require('../notifications/notifications.service');
const logger = require('../../config/logger');

const TICKET_INCLUDE = {
  creator: { select: { id: true, firstName: true, lastName: true, email: true } },
  assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
  department: { select: { id: true, name: true, code: true } },
  _count: { select: { comments: true, attachments: true } },
};

async function getSLADueDates(priority) {
  const slaConfig = await prisma.sLAConfiguration.findUnique({ where: { priority } });
  const now = new Date();
  if (!slaConfig) return { slaResponseDue: null, slaResolutionDue: null };
  return {
    slaResponseDue: addMinutes(now, slaConfig.responseTimeMinutes),
    slaResolutionDue: addMinutes(now, slaConfig.resolutionTimeMinutes),
  };
}

async function createTicket(data, creatorId) {
  const { title, description, category, priority = 'P3_MEDIUM', tags = [], offlineId, departmentId, impact, urgency } = data;

  // Check duplicate offline ticket
  if (offlineId) {
    const existing = await prisma.ticket.findUnique({ where: { offlineId } });
    if (existing) return existing;
  }

  const ticketNumber = generateTicketNumber();
  const slaDates = await getSLADueDates(priority);

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber, title, description, category, priority, tags,
      offlineId, departmentId, impact, urgency,
      creatorId,
      ...slaDates,
    },
    include: TICKET_INCLUDE,
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id, changedById: creatorId,
      field: 'status', oldValue: null, newValue: 'OPEN', action: 'CREATED',
    },
  });

  // Auto-route ticket (non-blocking)
  routingEngine.autoRouteTicket(ticket).catch(err =>
    logger.error('Auto-routing error:', err.message)
  );

  // Notify creator
  notificationService.sendTicketNotification('TICKET_CREATED', ticket, creatorId).catch(() => {});

  logger.info(`Ticket created: ${ticketNumber} by ${creatorId}`);
  return ticket;
}

async function getTickets(query, userId, userPermissions) {
  const { page, limit, skip } = getPagination(query);
  const { search, status, priority, category, assigneeId, creatorId, slaBreached, sortBy, sortOrder, departmentId } = query;

  const canReadAll = userPermissions?.includes(PERMISSIONS.TICKET_READ_ALL);
  const where = { deletedAt: null };

  if (!canReadAll) where.creatorId = userId;
  else {
    if (creatorId) where.creatorId = creatorId;
    if (assigneeId) where.assigneeId = assigneeId;
  }

  if (search) {
    where.OR = [
      { ticketNumber: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;
  if (departmentId) where.departmentId = departmentId;
  if (slaBreached === 'true') where.slaBreached = true;

  const orderBy = buildOrderBy(sortBy, sortOrder, ['createdAt', 'updatedAt', 'priority', 'status', 'ticketNumber']);

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({ where, include: TICKET_INCLUDE, skip, take: limit, orderBy }),
    prisma.ticket.count({ where }),
  ]);

  return { tickets, total, page, limit };
}

async function getTicketById(id, userId, userPermissions) {
  const ticket = await prisma.ticket.findUnique({
    where: { id, deletedAt: null },
    include: {
      ...TICKET_INCLUDE,
      comments: {
        where: { deletedAt: null },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          attachments: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      attachments: { orderBy: { createdAt: 'desc' } },
      history: {
        include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!ticket) throw new NotFoundError('Ticket not found');

  const canReadAll = userPermissions?.includes(PERMISSIONS.TICKET_READ_ALL);
  if (!canReadAll && ticket.creatorId !== userId) {
    throw new AuthorizationError('Access denied');
  }

  // Filter internal comments for end users
  if (!canReadAll) {
    ticket.comments = ticket.comments.filter(c => !c.isInternal);
  }

  return ticket;
}

async function updateTicket(id, data, userId, userPermissions) {
  const ticket = await prisma.ticket.findUnique({ where: { id, deletedAt: null } });
  if (!ticket) throw new NotFoundError('Ticket not found');

  const canUpdateAll = userPermissions?.includes(PERMISSIONS.TICKET_UPDATE_ALL);
  const canUpdateOwn = userPermissions?.includes(PERMISSIONS.TICKET_UPDATE_OWN);

  if (!canUpdateAll && !(canUpdateOwn && ticket.creatorId === userId)) {
    throw new AuthorizationError('Cannot update this ticket');
  }

  const allowedFields = canUpdateAll
    ? ['title', 'description', 'priority', 'category', 'tags', 'impact', 'urgency', 'departmentId', 'isPublic']
    : ['title', 'description', 'tags'];

  const updateData = {};
  const historyEntries = [];

  for (const field of allowedFields) {
    if (data[field] !== undefined && data[field] !== ticket[field]) {
      historyEntries.push({
        ticketId: id, changedById: userId, field,
        oldValue: String(ticket[field] ?? ''),
        newValue: String(data[field] ?? ''),
        action: 'UPDATED',
      });
      updateData[field] = data[field];
    }
  }

  // Recalculate SLA if priority changed
  if (updateData.priority && updateData.priority !== ticket.priority) {
    const slaDates = await getSLADueDates(updateData.priority);
    Object.assign(updateData, slaDates, { slaBreached: false });
  }

  if (Object.keys(updateData).length === 0) return ticket;

  updateData.lastActivityAt = new Date();

  const [updated] = await prisma.$transaction([
    prisma.ticket.update({ where: { id }, data: updateData, include: TICKET_INCLUDE }),
    ...historyEntries.map(h => prisma.ticketHistory.create({ data: h })),
  ]);

  return updated;
}

async function assignTicket(id, assigneeId, assignedById, userPermissions) {
  if (!userPermissions?.includes(PERMISSIONS.TICKET_ASSIGN)) throw new AuthorizationError('Cannot assign tickets');

  const ticket = await prisma.ticket.findUnique({ where: { id, deletedAt: null } });
  if (!ticket) throw new NotFoundError('Ticket not found');

  if (assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId, status: 'ACTIVE' } });
    if (!assignee) throw new NotFoundError('Assignee not found');
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      assigneeId,
      status: assigneeId ? 'ASSIGNED' : 'OPEN',
      assignedAt: assigneeId ? new Date() : null,
      firstResponseAt: ticket.firstResponseAt ?? (assigneeId ? new Date() : null),
      lastActivityAt: new Date(),
    },
    include: TICKET_INCLUDE,
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: id, changedById: assignedById,
      field: 'assigneeId', oldValue: ticket.assigneeId, newValue: assigneeId,
      action: 'ASSIGNED',
    },
  });

  if (assigneeId) {
    notificationService.sendTicketNotification('TICKET_ASSIGNED', updated, assigneeId).catch(() => {});
    notificationService.sendTicketNotification('TICKET_UPDATED', updated, ticket.creatorId).catch(() => {});
  }

  return updated;
}

async function changeStatus(id, status, userId, note, userPermissions) {
  const ticket = await prisma.ticket.findUnique({ where: { id, deletedAt: null } });
  if (!ticket) throw new NotFoundError('Ticket not found');

  const canUpdateAll = userPermissions?.includes(PERMISSIONS.TICKET_UPDATE_ALL);
  const canClose = userPermissions?.includes(PERMISSIONS.TICKET_CLOSE);

  // Validate state transitions
  const transitions = {
    OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
    ASSIGNED: ['IN_PROGRESS', 'PENDING', 'RESOLVED', 'ESCALATED'],
    IN_PROGRESS: ['PENDING', 'RESOLVED', 'ESCALATED'],
    PENDING: ['IN_PROGRESS', 'RESOLVED'],
    RESOLVED: ['CLOSED', 'OPEN'],
    CLOSED: ['OPEN'],
    ESCALATED: ['ASSIGNED', 'IN_PROGRESS'],
  };

  if (!transitions[ticket.status]?.includes(status)) {
    throw new AppError(`Cannot transition from ${ticket.status} to ${status}`, 400);
  }

  if ((status === 'CLOSED') && !canClose && !canUpdateAll) {
    throw new AuthorizationError('Cannot close tickets');
  }

  const updateData = { status, lastActivityAt: new Date() };
  if (status === 'RESOLVED') {
    updateData.resolvedAt = new Date();
    updateData.slaResolutionMet = ticket.slaResolutionDue ? new Date() <= ticket.slaResolutionDue : null;
  }
  if (status === 'CLOSED') updateData.closedAt = new Date();
  if (status === 'ESCALATED') updateData.escalatedAt = new Date();
  if (status === 'IN_PROGRESS' && !ticket.firstResponseAt) updateData.firstResponseAt = new Date();

  const updated = await prisma.ticket.update({ where: { id }, data: updateData, include: TICKET_INCLUDE });

  await prisma.ticketHistory.create({
    data: {
      ticketId: id, changedById: userId,
      field: 'status', oldValue: ticket.status, newValue: status,
      action: status, note,
    },
  });

  notificationService.sendTicketNotification('TICKET_UPDATED', updated, ticket.creatorId).catch(() => {});
  if (status === 'RESOLVED' && ticket.assigneeId) {
    notificationService.sendTicketNotification('TICKET_RESOLVED', updated, ticket.assigneeId).catch(() => {});
  }

  return updated;
}

async function addComment(ticketId, content, authorId, isInternal = false, attachments = []) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId, deletedAt: null } });
  if (!ticket) throw new NotFoundError('Ticket not found');

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId, content, authorId, isInternal,
      attachments: attachments.length ? { createMany: { data: attachments } } : undefined,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      attachments: true,
    },
  });

  await prisma.ticket.update({ where: { id: ticketId }, data: { lastActivityAt: new Date() } });

  if (!isInternal) {
    notificationService.sendTicketNotification('COMMENT_ADDED', ticket, ticket.creatorId).catch(() => {});
  }

  return comment;
}

async function deleteComment(commentId, userId, userPermissions) {
  const comment = await prisma.ticketComment.findUnique({ where: { id: commentId, deletedAt: null } });
  if (!comment) throw new NotFoundError('Comment not found');

  const canManage = userPermissions?.includes(PERMISSIONS.TICKET_UPDATE_ALL);
  if (!canManage && comment.authorId !== userId) throw new AuthorizationError('Cannot delete this comment');

  await prisma.ticketComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
}

async function addAttachment(ticketId, fileData, uploaderId) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId, deletedAt: null } });
  if (!ticket) throw new NotFoundError('Ticket not found');

  return prisma.ticketAttachment.create({ data: { ...fileData, ticketId, uploadedById: uploaderId } });
}

async function escalateTicket(id, userId, note, userPermissions) {
  if (!userPermissions?.includes(PERMISSIONS.TICKET_ESCALATE)) throw new AuthorizationError('Cannot escalate tickets');
  return changeStatus(id, 'ESCALATED', userId, note, userPermissions);
}

async function getTicketHistory(ticketId) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError('Ticket not found');

  return prisma.ticketHistory.findMany({
    where: { ticketId },
    include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  createTicket, getTickets, getTicketById, updateTicket, assignTicket,
  changeStatus, addComment, deleteComment, addAttachment, escalateTicket, getTicketHistory,
};
