// src/middleware/rateLimiter.middleware.js
const rateLimit = require('express-rate-limit');

const defaultLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.', errors: [] },
});

const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many authentication attempts.', errors: [] },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Rate limit exceeded.', errors: [] },
});

module.exports = { defaultLimiter, authLimiter, strictLimiter };

// ============================================================
// src/middleware/validate.middleware.js
// ============================================================
const Joi = require('joi');
const { ValidationError } = require('../shared/errors');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = source === 'body' ? req.body
      : source === 'query' ? req.query
      : source === 'params' ? req.params
      : { ...req.params, ...req.query, ...req.body };

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const errors = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, ''),
      }));
      return next(new ValidationError('Validation failed', errors));
    }

    if (source === 'body') req.body = value;
    else if (source === 'query') req.query = value;
    else if (source === 'params') req.params = value;
    next();
  };
}

module.exports.validate = validate;

// ============================================================
// src/middleware/sanitize.middleware.js
// ============================================================
const xss = require('xss');

function sanitize(req, res, next) {
  function clean(obj) {
    if (typeof obj === 'string') return xss(obj);
    if (Array.isArray(obj)) return obj.map(clean);
    if (obj && typeof obj === 'object') {
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, clean(v)]));
    }
    return obj;
  }

  req.body = clean(req.body);
  req.query = clean(req.query);
  next();
}

module.exports.sanitize = sanitize;

// ============================================================
// src/middleware/audit.middleware.js
// ============================================================
const { prisma: db } = require('../config/database');
const logger = require('../config/logger');

function auditLog(action, resource) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (res.statusCode < 400 && req.user) {
        db.auditLog.create({
          data: {
            action,
            resource,
            resourceId: req.params?.id || data?.data?.id || null,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            userId: req.user.id,
            newValues: req.body ? JSON.parse(JSON.stringify(req.body)) : null,
          },
        }).catch(err => logger.error('Audit log error:', err.message));
      }
      return originalJson(data);
    };
    next();
  };
}

module.exports.auditLog = auditLog;

// ============================================================
// src/middleware/requestLogger.middleware.js
// ============================================================
const morgan = require('morgan');
const loggerInst = require('../config/logger');

const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream: { write: (msg) => loggerInst.http(msg.trim()) } }
);

module.exports.requestLogger = requestLogger;
