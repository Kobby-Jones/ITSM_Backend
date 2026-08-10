// src/modules/users/users.controller.js
const usersService = require('./users.service');
const ApiResponse = require('../../shared/response');
const { getFileUrl } = require('../../middleware/upload.middleware');

async function getUsers(req, res) {
  const { users, total, page, limit } = await usersService.getUsers(req.query);
  ApiResponse.paginated(res, { data: users, total, page, limit });
}

async function getUserById(req, res) {
  const user = await usersService.getUserById(req.params.id);
  ApiResponse.success(res, { data: user });
}

async function updateUser(req, res) {
  const user = await usersService.updateUser(req.params.id, req.body, req.user.id, req.user.role?.name);
  ApiResponse.success(res, { message: 'User updated', data: user });
}

async function updateUserRole(req, res) {
  const user = await usersService.updateUserRole(req.params.id, req.body.roleId);
  ApiResponse.success(res, { message: 'Role updated', data: user });
}

async function updateUserStatus(req, res) {
  const user = await usersService.updateUserStatus(req.params.id, req.body.status);
  ApiResponse.success(res, { message: 'Status updated', data: user });
}

async function deleteUser(req, res) {
  await usersService.softDeleteUser(req.params.id);
  ApiResponse.success(res, { message: 'User deleted', data: {} });
}

async function uploadAvatar(req, res) {
  if (!req.file) return ApiResponse.badRequest(res, { message: 'No file uploaded' });
  const avatarUrl = getFileUrl(req, req.file);
  const result = await usersService.updateAvatar(req.user.id, avatarUrl);
  ApiResponse.success(res, { message: 'Avatar uploaded', data: result });
}

async function updateFcmToken(req, res) {
  await usersService.updateFcmToken(req.user.id, req.body.fcmToken);
  ApiResponse.success(res, { message: 'FCM token updated', data: {} });
}

async function getUserStats(req, res) {
  const stats = await usersService.getUserStats(req.params.id || req.user.id);
  ApiResponse.success(res, { data: stats });
}

async function getTechnicians(req, res) {
  const technicians = await usersService.getTechnicians();
  ApiResponse.success(res, { data: technicians });
}

module.exports = {
  getUsers, getUserById, updateUser, updateUserRole, updateUserStatus,
  deleteUser, uploadAvatar, updateFcmToken, getUserStats, getTechnicians,
};
