// src/modules/notifications/notifications.routes.js
const express = require('express');
const router = express.Router();
const notificationsService = require('./notifications.service');
const ApiResponse = require('../../shared/response');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { PERMISSIONS } = require('../../shared/constants');

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Notification management
 */

router.use(authenticate);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 */
router.get('/', async (req, res) => {
  const result = await notificationsService.getNotifications(req.user.id, req.query);
  ApiResponse.paginated(res, { data: result.notifications, total: result.total, page: result.page, limit: result.limit,
    message: `${result.unreadCount} unread notifications` });
});

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 */
router.get('/unread-count', async (req, res) => {
  const count = await notificationsService.getUnreadCount(req.user.id);
  ApiResponse.success(res, { data: { count } });
});

/**
 * @swagger
 * /notifications/mark-all-read:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 */
router.patch('/mark-all-read', async (req, res) => {
  await notificationsService.markAllAsRead(req.user.id);
  ApiResponse.success(res, { message: 'All notifications marked as read', data: {} });
});

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 */
router.patch('/:id/read', async (req, res) => {
  await notificationsService.markAsRead(req.params.id, req.user.id);
  ApiResponse.success(res, { message: 'Notification marked as read', data: {} });
});

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
 */
router.delete('/:id', async (req, res) => {
  await notificationsService.deleteNotification(req.params.id, req.user.id);
  ApiResponse.success(res, { message: 'Notification deleted', data: {} });
});

/**
 * @swagger
 * /notifications/broadcast:
 *   post:
 *     summary: Send system broadcast notification (admin only)
 *     tags: [Notifications]
 */
router.post('/broadcast',
  authorize(PERMISSIONS.SYSTEM_CONFIG),
  async (req, res) => {
    const { userIds, title, message, type } = req.body;
    await notificationsService.sendSystemNotification(userIds, { title, message, type });
    ApiResponse.success(res, { message: 'Broadcast sent', data: {} });
  }
);

module.exports = router;
