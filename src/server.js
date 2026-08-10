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
const { connectDatabase } = require('./config/database');
const { getRedisClient } = require('./config/redis');
const { initFirebase } = require('./config/firebase');
const swaggerSpec = require('./config/swagger');
const { initQueues, startWorkers, scheduleSLAChecks } = require('./jobs');

const { defaultLimiter } = require('./middleware/index');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { requestLogger } = require('./middleware/index');
const { sanitize } = require('./middleware/index');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const ticketsRoutes = require('./modules/tickets/tickets.routes');
const routingRoutes = require('./modules/routing/routing.controller');
const slaRoutes = require('./modules/sla/sla.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const kbRoutes = require('./modules/knowledge-base/kb.routes');
const assetsRoutes = require('./modules/assets/assets.routes');
const telemetryRoutes = require('./modules/telemetry/telemetry.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const { syncRouter, searchRouter } = require('./modules/sync/sync.routes');
const { rolesRouter, auditRouter } = require('./modules/roles/roles.routes');

const app = express();
const PORT = parseInt(process.env.PORT) || 3000;
const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
    if (!origin || allowed.includes(origin) || allowed.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ============================================================
// BODY PARSING & UTILITIES
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(requestLogger);
app.use(sanitize);

// Static file serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads')));

// ============================================================
// RATE LIMITING
// ============================================================
app.use(API_PREFIX, defaultLimiter);

// ============================================================
// HEALTH & METRICS
// ============================================================
app.get('/health', async (req, res) => {
  const { prisma } = require('./config/database');
  let dbStatus = 'ok', redisStatus = 'ok';

  try { await prisma.$queryRaw`SELECT 1`; } catch { dbStatus = 'error'; }
  try {
    const redis = getRedisClient();
    await redis.ping();
  } catch { redisStatus = 'error'; }

  const healthy = dbStatus === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    services: { database: dbStatus, redis: redisStatus },
    uptime: Math.round(process.uptime()),
  });
});

app.get('/metrics', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// API DOCUMENTATION
// ============================================================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'ITSM API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: { persistAuthorization: true },
}));

app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ============================================================
// API ROUTES
// ============================================================
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/tickets`, ticketsRoutes);
app.use(`${API_PREFIX}/routing`, routingRoutes);
app.use(`${API_PREFIX}/sla`, slaRoutes);
app.use(`${API_PREFIX}/notifications`, notificationsRoutes);
app.use(`${API_PREFIX}/knowledge-base`, kbRoutes);
app.use(`${API_PREFIX}/assets`, assetsRoutes);
app.use(`${API_PREFIX}/telemetry`, telemetryRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/sync`, syncRouter);
app.use(`${API_PREFIX}/search`, searchRouter);
app.use(`${API_PREFIX}/roles`, rolesRouter);
app.use(`${API_PREFIX}/audit`, auditRouter);

// ============================================================
// ERROR HANDLING
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================
function setupGracefulShutdown(server) {
  const REDIS_ERRORS = ['ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'Connection is closed'];

  const isRedisError = (err) => {
    const msg = (err && (err.message || String(err))) || '';
    return REDIS_ERRORS.some(e => msg.includes(e) || (err && err.code === e));
  };

  const shutdown = async (signal) => {
    logger.info(`${signal} received - shutting down gracefully`);
    server.close(async () => {
      const { disconnectDatabase } = require('./config/database');
      await disconnectDatabase();
      try {
        const redis = getRedisClient();
        await redis.quit();
      } catch {}
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => { logger.error('Forced shutdown'); process.exit(1); }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    if (isRedisError(err)) {
      logger.warn('Redis connection error (non-fatal): ' + (err.message || err));
      return;
    }
    logger.error('Uncaught Exception: ' + err.message, { stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    if (isRedisError(reason)) {
      logger.warn('Redis rejection (non-fatal): ' + ((reason && reason.message) || reason));
      return;
    }
    logger.error('Unhandled Rejection: ' + ((reason && reason.message) || reason));
  });
}

// ============================================================
// STARTUP
// ============================================================
async function start() {
  try {
    logger.info(`Starting ${process.env.APP_NAME || 'ITSM Platform'}...`);

    // Connect database
    await connectDatabase();

    // Initialize Redis (non-blocking — server starts even if Redis is down)
    getRedisClient();

    // Firebase (non-blocking)
    initFirebase();

    // Background jobs (skipped gracefully if Redis unavailable)
    const queues = await initQueues();
    if (queues) {
      await startWorkers();
      await scheduleSLAChecks();
    }

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📖 API Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`🔍 Health: http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    setupGracefulShutdown(server);
    return server;
  } catch (err) {
    logger.error('Failed to start server: ' + err.message, { stack: err.stack });
    process.exit(1);
  }
}

start();

module.exports = app;
