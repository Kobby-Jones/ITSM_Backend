// src/modules/auth/auth.controller.js
const authService = require('./auth.service');
const ApiResponse = require('../../shared/response');

async function register(req, res) {
  const result = await authService.register(req.body);
  ApiResponse.created(res, { message: 'Registration successful. Please verify your email.', data: result });
}

async function login(req, res) {
  const { email, password } = req.body;
  const result = await authService.login(email, password, req.ip, req.get('user-agent'));
  ApiResponse.success(res, { message: 'Login successful', data: result });
}

async function refreshToken(req, res) {
  const { refreshToken } = req.body;
  const result = await authService.refreshTokens(refreshToken);
  ApiResponse.success(res, { message: 'Token refreshed', data: result });
}

async function logout(req, res) {
  await authService.logout(req.user.id, req.token);
  ApiResponse.success(res, { message: 'Logged out successfully', data: {} });
}

async function forgotPassword(req, res) {
  await authService.forgotPassword(req.body.email);
  ApiResponse.success(res, { message: 'If the email exists, a reset link has been sent', data: {} });
}

async function resetPassword(req, res) {
  await authService.resetPassword(req.body.token, req.body.password);
  ApiResponse.success(res, { message: 'Password reset successfully', data: {} });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  ApiResponse.success(res, { message: 'Password changed successfully', data: {} });
}

async function verifyEmail(req, res) {
  await authService.verifyEmail(req.body.token);
  ApiResponse.success(res, { message: 'Email verified successfully', data: {} });
}

async function resendVerification(req, res) {
  await authService.resendVerification(req.body.email);
  ApiResponse.success(res, { message: 'If unverified, a new verification email has been sent', data: {} });
}

async function me(req, res) {
  const user = req.user;
  const permissions = user.role?.permissions?.map(rp => rp.permission.name) || [];
  ApiResponse.success(res, {
    data: {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      phone: user.phone, avatarUrl: user.avatarUrl, employeeId: user.employeeId,
      role: user.role?.name, roleName: user.role?.displayName, permissions,
      status: user.status, emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt, createdAt: user.createdAt,
    },
  });
}

async function getSessions(req, res) {
  const sessions = await authService.getSessions(req.user.id);
  ApiResponse.success(res, { data: sessions });
}

async function revokeSession(req, res) {
  await authService.revokeSession(req.user.id, req.params.sessionId);
  ApiResponse.success(res, { message: 'Session revoked', data: {} });
}

module.exports = {
  register, login, refreshToken, logout, forgotPassword, resetPassword,
  changePassword, verifyEmail, resendVerification, me, getSessions, revokeSession,
};
