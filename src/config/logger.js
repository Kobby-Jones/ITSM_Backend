// src/config/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';
const logDir = process.env.LOG_DIR || 'logs';

// Local development may use file logs.
// Production containers log only to stdout/stderr.
if (!isProduction && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Convert Error objects and Buffers into useful log output.
const errorSerializer = winston.format((info) => {
  Object.keys(info).forEach((key) => {
    if (
      key === 'level' ||
      key === 'message' ||
      key === 'timestamp'
    ) {
      return;
    }

    const val = info[key];

    if (val instanceof Error) {
      info[key] = {
        message: val.message,
        stack: val.stack,
      };
    } else if (Buffer.isBuffer(val)) {
      info[key] = val.toString();
    }
  });

  return info;
});

const format = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  errorSerializer(),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  errorSerializer(),
  winston.format.printf(
    ({
      timestamp,
      level,
      message,
      stack,
      ...meta
    }) => {
      let out = `${timestamp} [${level}]: ${message}`;

      if (stack) {
        out += `\n${stack}`;
      }

      const cleanMeta = Object.keys(meta).filter(
        (key) => !['splat'].includes(key)
      );

      if (cleanMeta.length) {
        out +=
          ' ' +
          JSON.stringify(
            Object.fromEntries(
              cleanMeta.map((key) => [
                key,
                meta[key],
              ])
            )
          );
      }

      return out;
    }
  )
);

const transports = [
  new winston.transports.Console({
    format: isProduction
      ? format
      : consoleFormat,
  }),
];

// Keep rotating file logs only for local/non-production use.
if (!isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join(
        logDir,
        'error.log'
      ),
      level: 'error',
      format,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(
        logDir,
        'combined.log'
      ),
      format,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    })
  );
}

const exceptionHandlers = isProduction
  ? [
      new winston.transports.Console({
        format,
      }),
    ]
  : [
      new winston.transports.File({
        filename: path.join(
          logDir,
          'exceptions.log'
        ),
        format,
      }),
    ];

const rejectionHandlers = isProduction
  ? [
      new winston.transports.Console({
        format,
      }),
    ]
  : [
      new winston.transports.File({
        filename: path.join(
          logDir,
          'rejections.log'
        ),
        format,
      }),
    ];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exceptionHandlers,
  rejectionHandlers,
});

module.exports = logger;