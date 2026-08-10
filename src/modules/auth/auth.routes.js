// src/modules/auth/auth.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('./auth.controller');
const validators = require('./auth.validator');
const { validate } = require('../../middleware/index');
const { authenticate } = require('../../middleware/auth.middleware');
const { authLimiter, strictLimiter } = require('../../middleware/index');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Auth endpoints
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register new user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *               employeeId: { type: string }
 *     responses:
 *       201: { description: Registered successfully }
 *       409: { description: Email already exists }
 */
router.post('/register', authLimiter, validate(validators.register), ctrl.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful with tokens }
 *       401: { description: Invalid credentials }
 */
router.post('/login', authLimiter, validate(validators.login), ctrl.login);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     security: []
 */
router.post('/refresh-token', validate(validators.refreshToken), ctrl.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout current user
 *     tags: [Authentication]
 */
router.post('/logout', authenticate, ctrl.logout);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     security: []
 */
router.post('/forgot-password', strictLimiter, validate(validators.forgotPassword), ctrl.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     security: []
 */
router.post('/reset-password', validate(validators.resetPassword), ctrl.resetPassword);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change password (authenticated)
 *     tags: [Authentication]
 */
router.post('/change-password', authenticate, validate(validators.changePassword), ctrl.changePassword);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     security: []
 */
router.post('/verify-email', validate(validators.verifyEmail), ctrl.verifyEmail);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Authentication]
 *     security: []
 */
router.post('/resend-verification', strictLimiter, validate(validators.forgotPassword), ctrl.resendVerification);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 */
router.get('/me', authenticate, ctrl.me);

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     summary: Get active sessions
 *     tags: [Authentication]
 */
router.get('/sessions', authenticate, ctrl.getSessions);

/**
 * @swagger
 * /auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a session
 *     tags: [Authentication]
 */
router.delete('/sessions/:sessionId', authenticate, ctrl.revokeSession);

module.exports = router;
