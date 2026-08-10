// src/config/redis.js
const Redis = require('ioredis');
const logger = require('./logger');

let redisClient = null;
let redisAvailable = false;

function getRedisClient() {
  if (redisClient) return redisClient;

  const password = process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim()
    ? process.env.REDIS_PASSWORD : undefined;

  const options = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    ...(password ? { password } : {}),
    db: parseInt(process.env.REDIS_DB) || 0,
    retryStrategy(times) {
      if (times > 10) {
        logger.warn('Redis: max retries reached, giving up — caching disabled');
        return null;
      }
      return Math.min(times * 500, 5000);
    },
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 5000,
  };

  // Use host/port options directly — ignore REDIS_URL to avoid auth conflicts
  redisClient = new Redis(options);

  redisClient.on('connect', () => { redisAvailable = true; logger.info('✅ Redis connected'); });
  redisClient.on('ready', () => { redisAvailable = true; });
  redisClient.on('error', (err) => {
    redisAvailable = false;
    const ignored = ['ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED'];
    if (!ignored.includes(err.code)) {
      logger.error('Redis error: ' + err.message);
    }
  });
  redisClient.on('close', () => { redisAvailable = false; });
  redisClient.on('reconnecting', () => logger.info('Redis reconnecting...'));
  redisClient.on('end', () => {
    redisAvailable = false;
    logger.warn('Redis disconnected — caching disabled');
  });

  return redisClient;
}

function isRedisAvailable() { return redisAvailable; }

async function cacheGet(key) {
  if (!redisAvailable) return null;
  try { const v = await redisClient.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}

async function cacheSet(key, value, ttl = parseInt(process.env.CACHE_TTL) || 300) {
  if (!redisAvailable) return;
  try { await redisClient.setex(key, ttl, JSON.stringify(value)); } catch {}
}

async function cacheDel(key) {
  if (!redisAvailable) return;
  try { await redisClient.del(key); } catch {}
}

async function cacheDelPattern(pattern) {
  if (!redisAvailable) return;
  try { const keys = await redisClient.keys(pattern); if (keys.length) await redisClient.del(...keys); } catch {}
}

async function cacheExists(key) {
  if (!redisAvailable) return false;
  try { return await redisClient.exists(key); } catch { return false; }
}

module.exports = { getRedisClient, isRedisAvailable, cacheGet, cacheSet, cacheDel, cacheDelPattern, cacheExists };
