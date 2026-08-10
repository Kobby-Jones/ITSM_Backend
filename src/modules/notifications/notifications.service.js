// src/modules/notifications/notifications.service.js
const { prisma } = require('../../config/database');
const { sendPushNotification } = require('../../config/firebase');
const { sendEmail, getEmailTemplate } = require('../../config/email');
const { getPagination } = require('../../utils/helpers');
const logger = require('../../config/logger');

async function createNotification({ userId, type, title, message, data = {}, ticketId, channel = 'IN_APP' }) {
  return prisma.notification.create({
    data: { userId, type, title, message, data, ticketId, channel, sentAt: new Date() },
  });
}

async function sendTicketNotification(type, ticket, targetUserId) {
  if (!targetUserId) return;

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, firstName: true, fcmToken: true },
  });
  if (!user) return;

  const messages = {
    TICKET_CREATED: { title: 'Ticket Created', message: `Your ticket #${ticket.ticketNumber} has been created` },
    TICKET_ASSIGNED: { title: 'Ticket Assigned', message: `Ticket #${ticket.ticketNumber} has been assigned to you` },
    TICKET_UPDATED: { title: 'Ticket Updated', message: `Ticket #${ticket.ticketNumber} has been updated` },
    TICKET_RESOLVED: { title: 'Ticket Resolved', message: `Ticket #${ticket.ticketNumber} has been resolved` },
    TICKET_ESCALATED: { title: 'Ticket Escalated', message: `Ticket #${ticket.ticketNumber} has been escalated` },
    COMMENT_ADDED: { title: 'New Comment', message: `A new comment was added to ticket #${ticket.ticketNumber}` },
  };

  const { title, message } = messages[type] || { title: 'ITSM Notification', message: '' };

  const notifData = { ticketId: ticket.id, ticketNumber: ticket.ticketNumber, type };

  // In-app notification
  await createNotification({ userId: targetUserId, type, title, message, data: notifData, ticketId: ticket.id });

  // Push notification
  if (user.fcmToken) {
    sendPushNotification(user.fcmToken, { title, body: message, data: notifData }).catch(() => {});
  }

  // Email (for critical types)
  if (['TICKET_CREATED', 'TICKET_ASSIGNED', 'TICKET_RESOLVED'].includes(type) && user.email) {
    const emailTypes = {
      TICKET_CREATED: 'ticketCreated',
      TICKET_ASSIGNED: 'ticketAssigned',
      TICKET_RESOLVED: 'ticketCreated',
    };
    const template = getEmailTemplate(emailTypes[type], {
      firstName: user.firstName,
      ticketNumber: ticket.ticketNumber,
      ticketId: ticket.id,
      title: ticket.title,
      priority: ticket.priority,
      status: ticket.status,
      slaDue: ticket.slaResolutionDue,
    });
    sendEmail({ to: user.email, subject: template.subject, html: template.html }).catch(() => {});
  }
}

async function sendSLANotification(type, ticket, user) {
  if (!user) return;

  const messages = {
    SLA_WARNING: {
      title: '⚠️ SLA Warning',
      message: `Ticket #${ticket.ticketNumber} is approaching SLA breach`,
    },
    SLA_BREACH: {
      title: '🚨 SLA Breached',
      message: `Ticket #${ticket.ticketNumber} has breached its SLA`,
    },
  };

  const { title, message } = messages[type];

  await createNotification({ userId: user.id, type, title, message, ticketId: ticket.id, data: { ticketId: ticket.id } });

  if (user.fcmToken) {
    sendPushNotification(user.fcmToken, { title, body: message, data: { ticketId: ticket.id } }).catch(() => {});
  }

  if (user.email) {
    const template = getEmailTemplate('slaWarning', {
      firstName: user.firstName,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      priority: ticket.priority,
      slaDue: ticket.slaResolutionDue,
      timeRemaining: 'Check dashboard',
    });
    sendEmail({ to: user.email, subject: template.subject, html: template.html }).catch(() => {});
  }
}

async function sendSystemNotification(userIds, { title, message, type = 'SYSTEM_ALERT', data = {} }) {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, status: 'ACTIVE' },
    select: { id: true, fcmToken: true },
  });

  const fcmTokens = users.filter(u => u.fcmToken).map(u => u.fcmToken);

  await prisma.notification.createMany({
    data: users.map(u => ({ userId: u.id, type, title, message, data, channel: 'IN_APP' })),
  });

  if (fcmTokens.length) {
    const { sendMulticastNotification } = require('../../config/firebase');
    sendMulticastNotification(fcmTokens, { title, body: message, data }).catch(() => {});
  }
}

async function getNotifications(userId, query) {
  const { page, limit, skip } = getPagination(query);
  const { isRead } = query;

  const where = { userId };
  if (isRead !== undefined) where.isRead = isRead === 'true';

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, total, page, limit, unreadCount };
}

async function markAsRead(notificationId, userId) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
}

async function markAllAsRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

async function deleteNotification(notificationId, userId) {
  await prisma.notification.deleteMany({ where: { id: notificationId, userId } });
}

async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

module.exports = {
  createNotification, sendTicketNotification, sendSLANotification,
  sendSystemNotification, getNotifications, markAsRead, markAllAsRead,
  deleteNotification, getUnreadCount,
};
