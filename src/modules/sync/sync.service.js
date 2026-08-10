// src/modules/sync/sync.service.js
const { prisma } = require('../../config/database');
const ticketsService = require('../tickets/tickets.service');
const { getPagination } = require('../../utils/helpers');
const logger = require('../../config/logger');

async function submitSyncBatch(items, userId, userPermissions) {
  const results = [];

  for (const item of items) {
    try {
      const result = await processSyncItem(item, userId, userPermissions);
      results.push({ offlineId: item.offlineId, status: 'COMPLETED', data: result });
    } catch (err) {
      logger.error(`Sync item failed [${item.offlineId}]:`, err.message);
      results.push({ offlineId: item.offlineId, status: 'FAILED', error: err.message });

      // Queue failed item for retry
      await prisma.syncQueue.create({
        data: {
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          payload: item.payload,
          status: 'FAILED',
          userId,
          offlineId: item.offlineId,
          errorMessage: err.message,
          retryCount: 0,
        },
      }).catch(() => {});
    }
  }

  return results;
}

async function processSyncItem(item, userId, userPermissions) {
  const { entityType, operation, payload, offlineId, clientVersion } = item;

  if (entityType === 'ticket') {
    return processSyncTicket(operation, payload, userId, userPermissions, offlineId, clientVersion);
  }

  throw new Error(`Unsupported entity type: ${entityType}`);
}

async function processSyncTicket(operation, payload, userId, userPermissions, offlineId, clientVersion) {
  switch (operation) {
    case 'CREATE': {
      const ticketData = { ...payload, offlineId };
      return ticketsService.createTicket(ticketData, userId);
    }
    case 'UPDATE': {
      if (!payload.id) throw new Error('Missing ticket id for UPDATE');
      const existing = await prisma.ticket.findUnique({ where: { id: payload.id } });
      if (!existing) throw new Error('Ticket not found');

      // Server-authoritative conflict: if server version is newer, reject
      if (clientVersion && existing.updatedAt > new Date(clientVersion)) {
        return {
          conflict: true,
          serverData: existing,
          message: 'Conflict detected - server version is newer',
        };
      }

      return ticketsService.updateTicket(payload.id, payload, userId, userPermissions);
    }
    case 'COMMENT': {
      if (!payload.ticketId) throw new Error('Missing ticketId for COMMENT');
      return ticketsService.addComment(payload.ticketId, payload.content, userId, false);
    }
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

async function queueSyncItem(data, userId) {
  return prisma.syncQueue.create({
    data: {
      entityType: data.entityType,
      entityId: data.entityId,
      operation: data.operation,
      payload: data.payload,
      status: 'PENDING',
      userId,
      offlineId: data.offlineId,
      clientVersion: data.clientVersion,
    },
  });
}

async function getSyncQueue(userId, query) {
  const { page, limit, skip } = getPagination(query);
  const { status } = query;

  const where = { userId };
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.syncQueue.findMany({ where, orderBy: { createdAt: 'asc' }, skip, take: limit }),
    prisma.syncQueue.count({ where }),
  ]);

  return { items, total, page, limit };
}

async function processPendingQueue(userId, userPermissions) {
  const pending = await prisma.syncQueue.findMany({
    where: { userId, status: 'PENDING', retryCount: { lt: 3 } },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  const results = [];
  for (const item of pending) {
    try {
      await prisma.syncQueue.update({ where: { id: item.id }, data: { status: 'IN_PROGRESS', lastTriedAt: new Date() } });

      const result = await processSyncItem({
        entityType: item.entityType,
        entityId: item.entityId,
        operation: item.operation,
        payload: item.payload,
        offlineId: item.offlineId,
        clientVersion: item.clientVersion,
      }, userId, userPermissions);

      await prisma.syncQueue.update({
        where: { id: item.id },
        data: { status: 'COMPLETED', resolvedAt: new Date() },
      });

      results.push({ id: item.id, status: 'COMPLETED', data: result });
    } catch (err) {
      const retryCount = item.retryCount + 1;
      await prisma.syncQueue.update({
        where: { id: item.id },
        data: {
          status: retryCount >= 3 ? 'FAILED' : 'PENDING',
          retryCount,
          lastTriedAt: new Date(),
          errorMessage: err.message,
        },
      });
      results.push({ id: item.id, status: 'FAILED', error: err.message });
    }
  }

  return results;
}

async function getSyncStatus(userId) {
  const [pending, failed, completed] = await Promise.all([
    prisma.syncQueue.count({ where: { userId, status: 'PENDING' } }),
    prisma.syncQueue.count({ where: { userId, status: 'FAILED' } }),
    prisma.syncQueue.count({ where: { userId, status: 'COMPLETED' } }),
  ]);

  return { pending, failed, completed, needsSync: pending > 0 || failed > 0 };
}

module.exports = { submitSyncBatch, queueSyncItem, getSyncQueue, processPendingQueue, getSyncStatus };
