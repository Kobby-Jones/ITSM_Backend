// src/modules/users/users.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('./users.controller');
const validators = require('./users.controller'); // validators in same file
const Joi = require('joi');
const { validate } = require('../../middleware/index');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { upload, setUploadType } = require('../../middleware/upload.middleware');
const { PERMISSIONS } = require('../../shared/constants');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management
 */

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (paginated)
 *     tags: [Users]
 */
router.get('/', authorize(PERMISSIONS.USER_READ), ctrl.getUsers);

/**
 * @swagger
 * /users/technicians:
 *   get:
 *     summary: Get all technicians with workload
 *     tags: [Users]
 */
router.get('/technicians', authorize(PERMISSIONS.TICKET_ASSIGN), ctrl.getTechnicians);

/**
 * @swagger
 * /users/me/stats:
 *   get:
 *     summary: Get own stats
 *     tags: [Users]
 */
router.get('/me/stats', (req, res, next) => {
  req.params.id = req.user.id;
  next();
}, ctrl.getUserStats);

/**
 * @swagger
 * /users/me/avatar:
 *   post:
 *     summary: Upload avatar
 *     tags: [Users]
 */
router.post('/me/avatar',
  setUploadType('avatar'),
  upload.single('avatar'),
  ctrl.uploadAvatar
);

/**
 * @swagger
 * /users/me/fcm-token:
 *   patch:
 *     summary: Update FCM push token
 *     tags: [Users]
 */
router.patch('/me/fcm-token',
  validate(Joi.object({ fcmToken: Joi.string().required() })),
  ctrl.updateFcmToken
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 */
router.get('/:id', authorize(PERMISSIONS.USER_READ), ctrl.getUserById);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update user
 *     tags: [Users]
 */
router.patch('/:id',
  validate(Joi.object({
    firstName: Joi.string().min(2).max(50).trim(),
    lastName: Joi.string().min(2).max(50).trim(),
    phone: Joi.string().allow('', null),
    employeeId: Joi.string().allow('', null),
    departmentId: Joi.string().uuid().allow(null),
  })),
  ctrl.updateUser
);

/**
 * @swagger
 * /users/{id}/role:
 *   patch:
 *     summary: Update user role (admin only)
 *     tags: [Users]
 */
router.patch('/:id/role',
  authorize(PERMISSIONS.USER_MANAGE_ROLES),
  validate(Joi.object({ roleId: Joi.string().uuid().required() })),
  ctrl.updateUserRole
);

/**
 * @swagger
 * /users/{id}/status:
 *   patch:
 *     summary: Update user status (admin only)
 *     tags: [Users]
 */
router.patch('/:id/status',
  authorize(PERMISSIONS.USER_UPDATE),
  validate(Joi.object({ status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED').required() })),
  ctrl.updateUserStatus
);

/**
 * @swagger
 * /users/{id}/stats:
 *   get:
 *     summary: Get user stats
 *     tags: [Users]
 */
router.get('/:id/stats', authorize(PERMISSIONS.USER_READ), ctrl.getUserStats);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user (soft delete)
 *     tags: [Users]
 */
router.delete('/:id', authorize(PERMISSIONS.USER_DELETE), ctrl.deleteUser);

module.exports = router;
