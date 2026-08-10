// src/modules/tickets/tickets.controller.js
const ticketsService = require('./tickets.service');
const ApiResponse = require('../../shared/response');
const { getFileUrl } = require('../../middleware/upload.middleware');

function getUserPermissions(req) {
  return req.user?.role?.permissions?.map(rp => rp.permission.name) || [];
}

async function createTicket(req, res) {
  const ticket = await ticketsService.createTicket(req.body, req.user.id);
  ApiResponse.created(res, { message: 'Ticket created successfully', data: ticket });
}

async function getTickets(req, res) {
  const perms = getUserPermissions(req);
  const { tickets, total, page, limit } = await ticketsService.getTickets(req.query, req.user.id, perms);
  ApiResponse.paginated(res, { data: tickets, total, page, limit });
}

async function getTicketById(req, res) {
  const perms = getUserPermissions(req);
  const ticket = await ticketsService.getTicketById(req.params.id, req.user.id, perms);
  ApiResponse.success(res, { data: ticket });
}

async function updateTicket(req, res) {
  const perms = getUserPermissions(req);
  const ticket = await ticketsService.updateTicket(req.params.id, req.body, req.user.id, perms);
  ApiResponse.success(res, { message: 'Ticket updated', data: ticket });
}

async function assignTicket(req, res) {
  const perms = getUserPermissions(req);
  const ticket = await ticketsService.assignTicket(req.params.id, req.body.assigneeId, req.user.id, perms);
  ApiResponse.success(res, { message: 'Ticket assigned', data: ticket });
}

async function changeStatus(req, res) {
  const perms = getUserPermissions(req);
  const ticket = await ticketsService.changeStatus(req.params.id, req.body.status, req.user.id, req.body.note, perms);
  ApiResponse.success(res, { message: 'Status updated', data: ticket });
}

async function escalateTicket(req, res) {
  const perms = getUserPermissions(req);
  const ticket = await ticketsService.escalateTicket(req.params.id, req.user.id, req.body.note, perms);
  ApiResponse.success(res, { message: 'Ticket escalated', data: ticket });
}

async function addComment(req, res) {
  const perms = getUserPermissions(req);
  const canInternal = perms.includes('ticket:update:all');
  const comment = await ticketsService.addComment(
    req.params.id, req.body.content, req.user.id,
    canInternal ? req.body.isInternal : false
  );
  ApiResponse.created(res, { message: 'Comment added', data: comment });
}

async function deleteComment(req, res) {
  const perms = getUserPermissions(req);
  await ticketsService.deleteComment(req.params.commentId, req.user.id, perms);
  ApiResponse.success(res, { message: 'Comment deleted', data: {} });
}

async function uploadAttachment(req, res) {
  if (!req.file) return ApiResponse.badRequest(res, { message: 'No file uploaded' });
  const attachment = await ticketsService.addAttachment(req.params.id, {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: getFileUrl(req, req.file),
  }, req.user.id);
  ApiResponse.created(res, { message: 'Attachment uploaded', data: attachment });
}

async function getTicketHistory(req, res) {
  const history = await ticketsService.getTicketHistory(req.params.id);
  ApiResponse.success(res, { data: history });
}

module.exports = {
  createTicket, getTickets, getTicketById, updateTicket, assignTicket,
  changeStatus, escalateTicket, addComment, deleteComment, uploadAttachment, getTicketHistory,
};
