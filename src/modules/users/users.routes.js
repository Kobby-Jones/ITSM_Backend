// src/modules/users/users.routes.js
const express = require('express');
const Joi = require('joi');

const router = express.Router();
const ctrl = require('./users.controller');

const {
  validate,
} = require('../../middleware/index');

const {
  authenticate,
  authorize,
  authorizeSelfOr,
} = require('../../middleware/auth.middleware');

const {
  upload,
  setUploadType,
} = require('../../middleware/upload.middleware');

const {
  PERMISSIONS,
} = require('../../shared/constants');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management
 */

router.use(authenticate);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 */
router.get(
  '/',
  authorize(PERMISSIONS.USER_READ),
  ctrl.getUsers
);

/**
 * @swagger
 * /users/technicians:
 *   get:
 *     summary: Get technicians with workload
 *     tags: [Users]
 */
router.get(
  '/technicians',
  authorize(PERMISSIONS.TICKET_ASSIGN),
  ctrl.getTechnicians
);

/**
 * @swagger
 * /users/me/stats:
 *   get:
 *     summary: Get the authenticated user's statistics
 *     tags: [Users]
 */
router.get(
  '/me/stats',
  (req, res, next) => {
    req.params.id = req.user.id;
    next();
  },
  ctrl.getUserStats
);

/**
 * @swagger
 * /users/me/avatar:
 *   post:
 *     summary: Upload the authenticated user's avatar
 *     tags: [Users]
 */
router.post(
  '/me/avatar',
  setUploadType('avatar'),
  upload.single('avatar'),
  ctrl.uploadAvatar
);

/**
 * @swagger
 * /users/me/fcm-token:
 *   patch:
 *     summary: Update the authenticated user's FCM token
 *     tags: [Users]
 */
router.patch(
  '/me/fcm-token',

  validate(
    Joi.object({
      fcmToken: Joi.string()
        .trim()
        .required(),
    })
  ),

  ctrl.updateFcmToken
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 */
router.get(
  '/:id',
  authorize(PERMISSIONS.USER_READ),
  ctrl.getUserById
);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update a user
 *     tags: [Users]
 */
router.patch(
  '/:id',

  authorizeSelfOr(PERMISSIONS.USER_UPDATE),

  validate(
    Joi.object({
      firstName: Joi.string()
        .min(2)
        .max(50)
        .trim(),

      lastName: Joi.string()
        .min(2)
        .max(50)
        .trim(),

      phone: Joi.string()
        .trim()
        .allow('', null),

      employeeId: Joi.string()
        .trim()
        .allow('', null),

      departmentId: Joi.string()
        .uuid()
        .allow(null),
    }).min(1)
  ),

  ctrl.updateUser
);

/**
 * @swagger
 * /users/{id}/role:
 *   patch:
 *     summary: Update a user's role
 *     tags: [Users]
 */
router.patch(
  '/:id/role',

  authorize(PERMISSIONS.USER_MANAGE_ROLES),

  validate(
    Joi.object({
      roleId: Joi.string()
        .uuid()
        .required(),
    })
  ),

  ctrl.updateUserRole
);

/**
 * @swagger
 * /users/{id}/status:
 *   patch:
 *     summary: Update a user's account status
 *     tags: [Users]
 */
router.patch(
  '/:id/status',

  authorize(PERMISSIONS.USER_UPDATE),

  validate(
    Joi.object({
      status: Joi.string()
        .valid(
          'ACTIVE',
          'INACTIVE',
          'SUSPENDED'
        )
        .required(),
    })
  ),

  ctrl.updateUserStatus
);

/**
 * @swagger
 * /users/{id}/stats:
 *   get:
 *     summary: Get a user's statistics
 *     tags: [Users]
 */
router.get(
  '/:id/stats',
  authorize(PERMISSIONS.USER_READ),
  ctrl.getUserStats
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Soft-delete a user
 *     tags: [Users]
 */
router.delete(
  '/:id',
  authorize(PERMISSIONS.USER_DELETE),
  ctrl.deleteUser
);

module.exports = router;