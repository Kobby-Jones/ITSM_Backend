// src/modules/tickets/tickets.controller.js
const ticketsService = require('./tickets.service');
const ApiResponse = require('../../shared/response');

const {
  deleteFile,
} = require('../../middleware/upload.middleware');

function getUserPermissions(req) {
  return req.user?.role?.permissions?.map(
    rolePermission =>
      rolePermission.permission.name
  ) || [];
}

async function createTicket(req, res) {
  const ticket = await ticketsService.createTicket(
    req.body,
    req.user.id
  );

  ApiResponse.created(res, {
    message: 'Ticket created successfully',
    data: ticket,
  });
}

async function getTickets(req, res) {
  const permissions = getUserPermissions(req);

  const {
    tickets,
    total,
    page,
    limit,
  } = await ticketsService.getTickets(
    req.query,
    req.user.id,
    permissions
  );

  ApiResponse.paginated(res, {
    data: tickets,
    total,
    page,
    limit,
  });
}

async function getTicketById(req, res) {
  const permissions = getUserPermissions(req);

  const ticket = await ticketsService.getTicketById(
    req.params.id,
    req.user.id,
    permissions
  );

  ApiResponse.success(res, {
    data: ticket,
  });
}

async function updateTicket(req, res) {
  const permissions = getUserPermissions(req);

  const ticket = await ticketsService.updateTicket(
    req.params.id,
    req.body,
    req.user.id,
    permissions
  );

  ApiResponse.success(res, {
    message: 'Ticket updated',
    data: ticket,
  });
}

async function assignTicket(req, res) {
  const permissions = getUserPermissions(req);

  const ticket = await ticketsService.assignTicket(
    req.params.id,
    req.body.assigneeId,
    req.user.id,
    permissions
  );

  ApiResponse.success(res, {
    message: 'Ticket assigned',
    data: ticket,
  });
}

async function changeStatus(req, res) {
  const permissions = getUserPermissions(req);

  const ticket = await ticketsService.changeStatus(
    req.params.id,
    req.body.status,
    req.user.id,
    req.body.note,
    permissions
  );

  ApiResponse.success(res, {
    message: 'Status updated',
    data: ticket,
  });
}

async function escalateTicket(req, res) {
  const permissions = getUserPermissions(req);

  const ticket = await ticketsService.escalateTicket(
    req.params.id,
    req.user.id,
    req.body.note,
    permissions
  );

  ApiResponse.success(res, {
    message: 'Ticket escalated',
    data: ticket,
  });
}

async function addComment(req, res) {
  const permissions = getUserPermissions(req);

  const canCreateInternalComment =
    permissions.includes('ticket:update:all');

  const comment = await ticketsService.addComment(
    req.params.id,
    req.body.content,
    req.user.id,
    canCreateInternalComment
      ? req.body.isInternal
      : false,
    permissions
  );

  ApiResponse.created(res, {
    message: 'Comment added',
    data: comment,
  });
}

async function deleteComment(req, res) {
  const permissions = getUserPermissions(req);

  await ticketsService.deleteComment(
    req.params.id,
    req.params.commentId,
    req.user.id,
    permissions
  );

  ApiResponse.success(res, {
    message: 'Comment deleted',
    data: {},
  });
}

async function uploadAttachment(req, res) {
  if (!req.file) {
    return ApiResponse.badRequest(res, {
      message: 'No file uploaded',
    });
  }

  const permissions = getUserPermissions(req);

  try {
    const attachment =
      await ticketsService.addAttachment(
        req.params.id,
        {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        req.user.id,
        permissions
      );

    return ApiResponse.created(res, {
      message: 'Attachment uploaded',
      data: attachment,
    });
  } catch (error) {
    /*
     * Multer has already written the file.
     * Remove it when authorization or the database operation fails.
     */
    deleteFile(req.file.path);
    throw error;
  }
}

async function downloadAttachment(req, res, next) {
  try {
    const permissions = getUserPermissions(req);

    const attachment =
      await ticketsService.getAttachmentForDownload(
        req.params.id,
        req.params.attachmentId,
        req.user.id,
        permissions
      );

    res.download(
      attachment.filePath,
      attachment.originalName,
      error => {
        if (error) {
          next(error);
        }
      }
    );
  } catch (error) {
    next(error);
  }
}

async function getTicketHistory(req, res) {
  const permissions = getUserPermissions(req);

  const history =
    await ticketsService.getTicketHistory(
      req.params.id,
      req.user.id,
      permissions
    );

  ApiResponse.success(res, {
    data: history,
  });
}

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  assignTicket,
  changeStatus,
  escalateTicket,
  addComment,
  deleteComment,
  uploadAttachment,
  downloadAttachment,
  getTicketHistory,
};