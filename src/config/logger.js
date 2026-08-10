// src/config/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const levels = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };
const colors = { error: 'red', warn: 'yellow', info: 'green', http: 'magenta', debug: 'white' };
winston.addColors(colors);

// Custom format that converts Error objects / Buffers to strings
// so they don't appear as {0:'r',1:'e',...} character arrays in logs
const errorSerializer = winston.format((info) => {
  // If any metadata value is an Error, extract message + stack
  Object.keys(info).forEach(key => {
    if (key === 'level' || key === 'message' || key === 'timestamp') return;
    const val = info[key];
    if (val instanceof Error) {
      info[key] = { message: val.message, stack: val.stack };
    } else if (Buffer.isBuffer(val)) {
      info[key] = val.toString();
    }
  });
  return info;
});

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  errorSerializer(),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errorSerializer(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let out = `${timestamp} [${level}]: ${message}`;
    if (stack) out += `\n${stack}`;
    const cleanMeta = Object.keys(meta).filter(k => !['splat'].includes(k));
    if (cleanMeta.length) out += ' ' + JSON.stringify(Object.fromEntries(cleanMeta.map(k => [k, meta[k]])));
    return out;
  })
);

const transports = [
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? format : consoleFormat,
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format,
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
  }),
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format,
    maxsize: 10 * 1024 * 1024,
    maxFiles: 10,
  }),
];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logDir, 'rejections.log') }),
  ],
});

module.exports = logger;
