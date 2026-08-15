// src/policies/device.policy.js
const { AuthorizationError } = require('../shared/errors');
const { PERMISSIONS } = require('../shared/constants');

function canReadDevice(device, userId, permissionNames) {
  if (!device || !userId) return false;

  if (device.userId === userId) {
    return true;
  }

  return Array.isArray(permissionNames)
    && permissionNames.includes(PERMISSIONS.ANALYTICS_READ);
}

function assertCanReadDevice(device, userId, permissionNames) {
  if (!canReadDevice(device, userId, permissionNames)) {
    throw new AuthorizationError(
      'You do not have access to this device'
    );
  }
}

module.exports = {
  canReadDevice,
  assertCanReadDevice,
};