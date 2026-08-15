// src/policies/ticket.policy.js
const { AuthorizationError } = require('../shared/errors');
const { PERMISSIONS } = require('../shared/constants');

function hasPermission(permissionNames, permission) {
  return Array.isArray(permissionNames)
    && permissionNames.includes(permission);
}

function canReadTicket(ticket, userId, permissionNames) {
  if (!ticket || !userId) return false;

  if (hasPermission(
    permissionNames,
    PERMISSIONS.TICKET_READ_ALL
  )) {
    return true;
  }

  return hasPermission(
    permissionNames,
    PERMISSIONS.TICKET_READ_OWN
  ) && ticket.creatorId === userId;
}

function canUpdateTicket(ticket, userId, permissionNames) {
  if (!ticket || !userId) return false;

  if (hasPermission(
    permissionNames,
    PERMISSIONS.TICKET_UPDATE_ALL
  )) {
    return true;
  }

  return hasPermission(
    permissionNames,
    PERMISSIONS.TICKET_UPDATE_OWN
  ) && ticket.creatorId === userId;
}

function assertCanReadTicket(ticket, userId, permissionNames) {
  if (!canReadTicket(ticket, userId, permissionNames)) {
    throw new AuthorizationError(
      'You do not have access to this ticket'
    );
  }
}

function assertCanUpdateTicket(ticket, userId, permissionNames) {
  if (!canUpdateTicket(ticket, userId, permissionNames)) {
    throw new AuthorizationError(
      'You cannot update this ticket'
    );
  }
}

module.exports = {
  hasPermission,
  canReadTicket,
  canUpdateTicket,
  assertCanReadTicket,
  assertCanUpdateTicket,
};