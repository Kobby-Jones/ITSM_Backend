// src/shared/response/index.js

class ApiResponse {
  static success(res, { message = 'Success', data = {}, statusCode = 200, meta } = {}) {
    const response = { success: true, message, data };
    if (meta) response.meta = meta;
    return res.status(statusCode).json(response);
  }

  static created(res, { message = 'Created successfully', data = {} } = {}) {
    return res.status(201).json({ success: true, message, data });
  }

  static error(res, { message = 'An error occurred', errors = [], statusCode = 500 } = {}) {
    return res.status(statusCode).json({ success: false, message, errors });
  }

  static badRequest(res, { message = 'Bad request', errors = [] } = {}) {
    return res.status(400).json({ success: false, message, errors });
  }

  static unauthorized(res, { message = 'Unauthorized' } = {}) {
    return res.status(401).json({ success: false, message, errors: [] });
  }

  static forbidden(res, { message = 'Access denied' } = {}) {
    return res.status(403).json({ success: false, message, errors: [] });
  }

  static notFound(res, { message = 'Resource not found' } = {}) {
    return res.status(404).json({ success: false, message, errors: [] });
  }

  static conflict(res, { message = 'Conflict', errors = [] } = {}) {
    return res.status(409).json({ success: false, message, errors });
  }

  static paginated(res, { data, total, page, limit, message = 'Success' }) {
    const totalPages = Math.ceil(total / limit);
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  }
}

module.exports = ApiResponse;
