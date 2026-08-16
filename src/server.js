// src/server.js
require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const logger = require('./config/logger');

const {
  connectDatabase,
} = require('./config/database');

const {
  getRedisClient,
} = require('./config/redis');

const {
  initFirebase,
} = require('./config/firebase');

const swaggerSpec = require('./config/swagger');

const {
  initQueues,
  startWorkers,
  scheduleSLAChecks,
} = require('./jobs');

const {
  defaultLimiter,
  requestLogger,
  sanitize,
} = require('./middleware/index');

const {
  errorHandler,
  notFoundHandler,
} = require('./middleware/error.middleware');

const authRoutes =
  require('./modules/auth/auth.routes');

const usersRoutes =
  require('./modules/users/users.routes');

const ticketsRoutes =
  require('./modules/tickets/tickets.routes');

const routingRoutes =
  require('./modules/routing/routing.controller');

const slaRoutes =
  require('./modules/sla/sla.routes');

const notificationsRoutes =
  require('./modules/notifications/notifications.routes');

const knowledgeBaseRoutes =
  require('./modules/knowledge-base/kb.routes');

const assetsRoutes =
  require('./modules/assets/assets.routes');

const telemetryRoutes =
  require('./modules/telemetry/telemetry.routes');

const analyticsRoutes =
  require('./modules/analytics/analytics.routes');

const {
  syncRouter,
  searchRouter,
} = require('./modules/sync/sync.routes');

const {
  rolesRouter,
  auditRouter,
} = require('./modules/roles/roles.routes');

const app = express();

const PORT =
  parseInt(process.env.PORT, 10) || 3000;

const API_PREFIX =
  `/api/${process.env.API_VERSION || 'v1'}`;

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Trust the first proxy (nginx) so req.ip and rate limiting
// use the real client IP from X-Forwarded-For, not 172.x.x.x.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production',

    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = (
        process.env.ALLOWED_ORIGINS
        || 'http://localhost:3000'
      )
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);

      if (
        !origin
        || allowedOrigins.includes(origin)
        || allowedOrigins.includes('*')
      ) {
        callback(null, true);
        return;
      }

      callback(
        new Error('Not allowed by CORS')
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
    ],
  })
);

// ============================================================
// BODY PARSING AND UTILITIES
// ============================================================

app.use(
  express.json({
    limit: '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

app.use(compression());
app.use(requestLogger);
app.use(sanitize);

/*
 * Only avatars are public.
 * Ticket attachments must be downloaded through the authenticated
 * and object-authorized ticket attachment endpoint.
 */
const uploadRoot = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR || 'uploads'
);

app.use(
  '/uploads/avatars',

  express.static(
    path.join(uploadRoot, 'avatars'),
    {
      dotfiles: 'deny',
      index: false,
    }
  )
);

// ============================================================
// RATE LIMITING
// ============================================================

app.use(API_PREFIX, defaultLimiter);

// ============================================================
// HEALTH AND METRICS
// ============================================================

app.get(
  '/health',
  async (req, res) => {
    const {
      prisma,
    } = require('./config/database');

    let databaseStatus = 'ok';
    let redisStatus = 'ok';

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = 'error';
    }

    try {
      const redis = getRedisClient();
      await redis.ping();
    } catch {
      redisStatus = 'error';
    }

    const healthy =
      databaseStatus === 'ok';

    res
      .status(healthy ? 200 : 503)
      .json({
        status:
          healthy
            ? 'healthy'
            : 'degraded',

        version:
          process.env.npm_package_version
          || '1.0.0',

        timestamp:
          new Date().toISOString(),

        services: {
          database: databaseStatus,
          redis: redisStatus,
        },

        uptime:
          Math.round(process.uptime()),
      });
  }
);

app.get(
  '/metrics',
  (req, res) => {
    res.json({
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  }
);

// ============================================================
// API DOCUMENTATION
// ============================================================

app.use(
  '/api-docs',

  swaggerUi.serve,

  swaggerUi.setup(
    swaggerSpec,
    {
      customSiteTitle: 'ITSM API Docs',

      customCss:
        '.swagger-ui .topbar { display: none }',

      swaggerOptions: {
        persistAuthorization: true,
      },
    }
  )
);

app.get(
  '/api-docs.json',
  (req, res) => {
    res.json(swaggerSpec);
  }
);

// ============================================================
// API ROUTES
// ============================================================

app.use(
  `${API_PREFIX}/auth`,
  authRoutes
);

app.use(
  `${API_PREFIX}/users`,
  usersRoutes
);

app.use(
  `${API_PREFIX}/tickets`,
  ticketsRoutes
);

app.use(
  `${API_PREFIX}/routing`,
  routingRoutes
);

app.use(
  `${API_PREFIX}/sla`,
  slaRoutes
);

app.use(
  `${API_PREFIX}/notifications`,
  notificationsRoutes
);

app.use(
  `${API_PREFIX}/knowledge-base`,
  knowledgeBaseRoutes
);

app.use(
  `${API_PREFIX}/assets`,
  assetsRoutes
);

app.use(
  `${API_PREFIX}/telemetry`,
  telemetryRoutes
);

app.use(
  `${API_PREFIX}/analytics`,
  analyticsRoutes
);

app.use(
  `${API_PREFIX}/sync`,
  syncRouter
);

app.use(
  `${API_PREFIX}/search`,
  searchRouter
);

app.use(
  `${API_PREFIX}/roles`,
  rolesRouter
);

app.use(
  `${API_PREFIX}/audit`,
  auditRouter
);

// ============================================================
// ERROR HANDLING
// ============================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function setupGracefulShutdown(server) {
  const redisErrors = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ECONNABORTED',
    'Connection is closed',
  ];

  function isRedisError(error) {
    const message =
      error?.message
      || String(error || '');

    return redisErrors.some(
      redisError =>
        message.includes(redisError)
        || error?.code === redisError
    );
  }

  async function shutdown(signal) {
    logger.info(
      `${signal} received - shutting down gracefully`
    );

    server.close(async () => {
      const {
        disconnectDatabase,
      } = require('./config/database');

      await disconnectDatabase();

      try {
        const redis = getRedisClient();
        await redis.quit();
      } catch {
        // Redis may already be unavailable.
      }

      logger.info('Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown');
      process.exit(1);
    }, 10000);
  }

  process.on(
    'SIGTERM',
    () => shutdown('SIGTERM')
  );

  process.on(
    'SIGINT',
    () => shutdown('SIGINT')
  );

  process.on(
    'uncaughtException',
    error => {
      if (isRedisError(error)) {
        logger.warn(
          'Redis connection error (non-fatal): '
          + (error.message || error)
        );

        return;
      }

      logger.error(
        `Uncaught Exception: ${error.message}`,
        {
          stack: error.stack,
        }
      );

      process.exit(1);
    }
  );

  process.on(
    'unhandledRejection',
    reason => {
      if (isRedisError(reason)) {
        logger.warn(
          'Redis rejection (non-fatal): '
          + (reason?.message || reason)
        );

        return;
      }

      logger.error(
        'Unhandled Rejection: '
        + (reason?.message || reason)
      );
    }
  );
}

// ============================================================
// STARTUP
// ============================================================

async function start() {
  try {
    logger.info(
      `Starting ${
        process.env.APP_NAME
        || 'ITSM Platform'
      }...`
    );

    await connectDatabase();

    getRedisClient();
    initFirebase();

    const queues = await initQueues();

    if (queues) {
      await startWorkers();
      await scheduleSLAChecks();
    }

    const server = app.listen(
      PORT,
      () => {
        logger.info(
          `Server running on port ${PORT}`
        );

        logger.info(
          `API Docs: http://localhost:${PORT}/api-docs`
        );

        logger.info(
          `Health: http://localhost:${PORT}/health`
        );

        logger.info(
          `Environment: ${
            process.env.NODE_ENV
            || 'development'
          }`
        );
      }
    );

    setupGracefulShutdown(server);

    return server;
  } catch (error) {
    logger.error(
      `Failed to start server: ${error.message}`,
      {
        stack: error.stack,
      }
    );

    process.exit(1);
  }
}

/*
 * Start the HTTP server only when this file is run directly.
 * Supertest can import the Express application without opening a port.
 */
if (require.main === module) {
  start();
}

module.exports = app;