// src/jobs/index.js
const { Queue, Worker } = require('bullmq');
const { checkSLABreaches } = require('../modules/sla/sla.service');
const { sendEmail } = require('../config/email');
const { sendPushNotification } = require('../config/firebase');
const logger = require('../config/logger');

// Build Redis connection — prefer explicit host/port over REDIS_URL
// (REDIS_URL causes issues when it has no auth but env has password set)
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT) || 6379;
const redisPassword = process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim()
  ? process.env.REDIS_PASSWORD : undefined;

const connection = {
  host: redisHost,
  port: redisPort,
  ...(redisPassword ? { password: redisPassword } : {}),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
};

let emailQueue = null;
let notificationQueue = null;
let slaQueue = null;
let jobsEnabled = false;

// Probe Redis with an actual PING before initialising BullMQ
async function probeRedis() {
  const Redis = require('ioredis');
  const probe = new Redis({
    host: redisHost,
    port: redisPort,
    ...(redisPassword ? { password: redisPassword } : {}),
    lazyConnect: true,
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
  });
  probe.on('error', () => {}); // silence probe errors
  try {
    await probe.connect();
    await probe.ping();
    await probe.quit();
    return true;
  } catch {
    try { probe.disconnect(false); } catch {}
    return false;
  }
}

async function initQueues() {
  const reachable = await probeRedis();
  if (!reachable) {
    logger.warn('⚠️  Redis not reachable — job queues disabled (background jobs will be skipped)');
    return null;
  }

  try {
    emailQueue = new Queue('email', { connection });
    notificationQueue = new Queue('notifications', { connection });
    slaQueue = new Queue('sla-checks', { connection });

    // Suppress BullMQ internal Redis errors from crashing the process
    [emailQueue, notificationQueue, slaQueue].forEach(q => q.on('error', () => {}));

    jobsEnabled = true;
    logger.info('✅ Job queues initialized');
    return { emailQueue, notificationQueue, slaQueue };
  } catch (err) {
    logger.warn('⚠️  Job queues could not be initialized: ' + err.message);
    return null;
  }
}

async function startWorkers() {
  if (!jobsEnabled) {
    logger.warn('⚠️  Job workers skipped (Redis unavailable)');
    return null;
  }

  try {
    const emailWorker = new Worker('email', async (job) => {
      const { to, subject, html, text } = job.data;
      await sendEmail({ to, subject, html, text });
    }, { connection, concurrency: 5 });

    emailWorker.on('completed', job => logger.debug(`Email job ${job.id} completed`));
    emailWorker.on('failed', (job, err) => logger.error(`Email job ${job?.id} failed: ${err.message}`));
    emailWorker.on('error', () => {});

    const notifWorker = new Worker('notifications', async (job) => {
      const { fcmToken, title, body, data } = job.data;
      if (fcmToken) await sendPushNotification(fcmToken, { title, body, data });
    }, { connection, concurrency: 10 });

    notifWorker.on('failed', (job, err) => logger.error(`Notification job ${job?.id} failed: ${err.message}`));
    notifWorker.on('error', () => {});

    const slaWorker = new Worker('sla-checks', async (job) => {
      logger.info('Running scheduled SLA breach check...');
      const result = await checkSLABreaches();
      logger.info('SLA check result: ' + JSON.stringify(result));
    }, { connection, concurrency: 1 });

    slaWorker.on('failed', (job, err) => logger.error(`SLA job ${job?.id} failed: ${err.message}`));
    slaWorker.on('error', () => {});

    logger.info('✅ Job workers started');
    return { emailWorker, notifWorker, slaWorker };
  } catch (err) {
    logger.warn('⚠️  Job workers could not be started: ' + err.message);
    return null;
  }
}

async function scheduleSLAChecks() {
  if (!slaQueue) return;
  try {
    const repeatableJobs = await slaQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await slaQueue.removeRepeatableByKey(job.key);
    }
    await slaQueue.add('sla-check', {}, {
      repeat: { cron: process.env.SLA_CHECK_INTERVAL || '*/15 * * * *' },
      removeOnComplete: 10,
      removeOnFail: 5,
    });
    logger.info('✅ SLA check scheduled');
  } catch (err) {
    logger.warn('Failed to schedule SLA checks: ' + err.message);
  }
}

async function addEmailJob(emailData, opts = {}) {
  if (!emailQueue || !jobsEnabled) return;
  try {
    return emailQueue.add('send-email', emailData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      ...opts,
    });
  } catch (err) {
    logger.warn('Failed to add email job: ' + err.message);
  }
}

async function addNotificationJob(notifData, opts = {}) {
  if (!notificationQueue || !jobsEnabled) return;
  try {
    return notificationQueue.add('push-notification', notifData, {
      attempts: 2,
      removeOnComplete: 100,
      ...opts,
    });
  } catch (err) {
    logger.warn('Failed to add notification job: ' + err.message);
  }
}

module.exports = { initQueues, startWorkers, scheduleSLAChecks, addEmailJob, addNotificationJob };
