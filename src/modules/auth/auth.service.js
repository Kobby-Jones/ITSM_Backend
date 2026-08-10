// src/modules/auth/auth.service.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { cacheGet, cacheSet, cacheDel } = require('../../config/redis');
const { sendEmail, getEmailTemplate } = require('../../config/email');
const {
  signAccessToken, signRefreshToken, signResetToken, signVerifyToken,
  verifyRefreshToken, verifyResetToken, verifyEmailToken,
} = require('../../utils/jwt');
const {
  AuthenticationError, ConflictError, NotFoundError, ValidationError, AppError,
} = require('../../shared/errors');
const { CACHE_KEYS } = require('../../shared/constants');
const logger = require('../../config/logger');

async function register(data) {
  const { email, password, firstName, lastName, phone, employeeId, departmentId } = data;

  // Check existing user
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError('Email already registered');

  // Get default end_user role
  const role = await prisma.role.findUnique({ where: { name: 'end_user' } });
  if (!role) throw new AppError('Default role not configured', 500);

  const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      employeeId,
      departmentId,
      roleId: role.id,
      status: 'PENDING_VERIFICATION',
    },
    include: { role: true },
  });

  // Create email verification token
  const verifyToken = signVerifyToken({ userId: user.id, email: user.email });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.emailVerificationToken.create({
    data: { userId: user.id, token: verifyToken, expiresAt },
  });

  // Send welcome email (non-blocking)
  const template = getEmailTemplate('welcome', { firstName, token: verifyToken });
  sendEmail({ to: email, subject: template.subject, html: template.html }).catch(() => {});

  logger.info(`User registered: ${email}`);
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
}

async function login(email, password, ipAddress, userAgent) {
  const user = await prisma.user.findUnique({
    where: { email, deletedAt: null },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });

  if (!user) throw new AuthenticationError('Invalid credentials');

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil - new Date()) / 60000);
    throw new AuthenticationError(`Account locked. Try again in ${minutes} minutes`);
  }

  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    const attempts = user.failedLoginAttempts + 1;
    const updateData = { failedLoginAttempts: attempts };
    if (attempts >= 5) updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: updateData });
    throw new AuthenticationError('Invalid credentials');
  }

  if (user.status === 'SUSPENDED') throw new AuthenticationError('Account suspended');
  if (user.status === 'INACTIVE') throw new AuthenticationError('Account deactivated');

  const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role.name });
  const refreshTokenVal = signRefreshToken({ userId: user.id });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId: user.id, refreshToken: refreshTokenVal, ipAddress, userAgent, expiresAt },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  // Cache user data
  await cacheSet(CACHE_KEYS.USER(user.id), user, 300);

  const permissions = user.role.permissions.map(rp => rp.permission.name);

  logger.info(`User logged in: ${email} from ${ipAddress}`);

  return {
    accessToken,
    refreshToken: refreshTokenVal,
    user: {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: user.role.name, roleName: user.role.displayName, permissions,
      status: user.status, emailVerified: user.emailVerified,
    },
  };
}

async function refreshTokens(token) {
  const decoded = verifyRefreshToken(token);

  const session = await prisma.session.findUnique({ where: { refreshToken: token } });
  if (!session || !session.isValid) throw new AuthenticationError('Invalid refresh token');
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    throw new AuthenticationError('Refresh token expired');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId, deletedAt: null },
    include: { role: true },
  });
  if (!user || user.status !== 'ACTIVE') throw new AuthenticationError('User not found or inactive');

  const newAccessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role.name });
  const newRefreshToken = signRefreshToken({ userId: user.id });

  await prisma.session.update({
    where: { id: session.id },
    data: { refreshToken: newRefreshToken, updatedAt: new Date() },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

async function logout(userId, token) {
  // Blacklist access token (TTL = 15 min)
  if (token) await cacheSet(`blacklist:${token}`, '1', 900);

  // Invalidate all sessions or specific session
  await prisma.session.updateMany({
    where: { userId, isValid: true },
    data: { isValid: false },
  });

  await cacheDel(CACHE_KEYS.USER(userId));
  logger.info(`User logged out: ${userId}`);
}

async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });
  // Always return success to prevent email enumeration
  if (!user) return;

  // Invalidate old reset tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const resetToken = signResetToken({ userId: user.id });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token: resetToken, expiresAt },
  });

  const template = getEmailTemplate('passwordReset', { firstName: user.firstName, token: resetToken });
  sendEmail({ to: email, subject: template.subject, html: template.html }).catch(() => {});

  logger.info(`Password reset requested for: ${email}`);
}

async function resetPassword(token, newPassword) {
  const decoded = verifyResetToken(token);

  const resetRecord = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!resetRecord || resetRecord.used) throw new AuthenticationError('Invalid or used reset token');
  if (resetRecord.expiresAt < new Date()) throw new AuthenticationError('Reset token expired');
  if (resetRecord.userId !== decoded.userId) throw new AuthenticationError('Invalid token');

  const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: decoded.userId }, data: { password: hashedPassword } }),
    prisma.passwordResetToken.update({ where: { id: resetRecord.id }, data: { used: true } }),
    prisma.session.updateMany({ where: { userId: decoded.userId }, data: { isValid: false } }),
  ]);

  await cacheDel(CACHE_KEYS.USER(decoded.userId));
  logger.info(`Password reset for user: ${decoded.userId}`);
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new AuthenticationError('Current password is incorrect');

  const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });
  await prisma.session.updateMany({ where: { userId }, data: { isValid: false } });
  await cacheDel(CACHE_KEYS.USER(userId));
}

async function verifyEmail(token) {
  const decoded = verifyEmailToken(token);

  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!record || record.used) throw new AuthenticationError('Invalid or used verification token');
  if (record.expiresAt < new Date()) throw new AuthenticationError('Verification token expired');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: decoded.userId },
      data: { emailVerified: true, status: 'ACTIVE' },
    }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { used: true } }),
  ]);

  await cacheDel(CACHE_KEYS.USER(decoded.userId));
  logger.info(`Email verified for user: ${decoded.userId}`);
}

async function resendVerification(email) {
  const user = await prisma.user.findUnique({ where: { email, deletedAt: null } });
  if (!user || user.emailVerified) return;

  await prisma.emailVerificationToken.updateMany({ where: { userId: user.id, used: false }, data: { used: true } });

  const verifyToken = signVerifyToken({ userId: user.id, email: user.email });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.emailVerificationToken.create({ data: { userId: user.id, token: verifyToken, expiresAt } });

  const template = getEmailTemplate('welcome', { firstName: user.firstName, token: verifyToken });
  sendEmail({ to: email, subject: template.subject, html: template.html }).catch(() => {});
}

async function getSessions(userId) {
  return prisma.session.findMany({
    where: { userId, isValid: true, expiresAt: { gt: new Date() } },
    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function revokeSession(userId, sessionId) {
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new NotFoundError('Session not found');
  await prisma.session.update({ where: { id: sessionId }, data: { isValid: false } });
}

module.exports = {
  register, login, refreshTokens, logout, forgotPassword, resetPassword,
  changePassword, verifyEmail, resendVerification, getSessions, revokeSession,
};
