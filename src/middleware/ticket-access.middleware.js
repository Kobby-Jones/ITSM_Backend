// src/middleware/ticket-access.middleware.js
const { prisma } = require('../config/database');
const { NotFoundError } = require('../shared/errors');
const {
  assertCanReadTicket,
  assertCanUpdateTicket,
} = require('../policies/ticket.policy');

function getPermissionNames(user) {
  return user?.role?.permissions?.map(
    rolePermission => rolePermission.permission.name
  ) || [];
}

/**
 * Performs ticket authorization before later middleware can cause side
 * effects, such as saving an uploaded file to disk.
 */
function requireTicketAccess(access = 'read') {
  return async (req, res, next) => {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: {
          id: req.params.id,
          deletedAt: null,
        },
        select: {
          id: true,
          creatorId: true,
          assigneeId: true,
          status: true,
        },
      });

      if (!ticket) {
        throw new NotFoundError('Ticket not found');
      }

      const permissions = getPermissionNames(req.user);

      if (access === 'update') {
        assertCanUpdateTicket(
          ticket,
          req.user.id,
          permissions
        );
      } else {
        assertCanReadTicket(
          ticket,
          req.user.id,
          permissions
        );
      }

      req.authorizedTicket = ticket;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  requireTicketAccess,
  getPermissionNames,
};