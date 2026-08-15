// src/config/redis.js
const Redis = require('ioredis');

const logger = require('./logger');

let redisClient = null;
let redisAvailable = false;

const QUIET_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
]);

function buildRedisOptions() {
  const rawPassword =
    process.env.REDIS_PASSWORD;

  const password =
    rawPassword
    && rawPassword.trim()
      ? rawPassword
      : undefined;

  return {
    host:
      process.env.REDIS_HOST
      || 'localhost',

    port:
      parseInt(
        process.env.REDIS_PORT,
        10
      )
      || 6379,

    db:
      parseInt(
        process.env.REDIS_DB,
        10
      )
      || 0,

    ...(password
      ? { password }
      : {}),

    /*
     * The first Redis command starts the connection.
     */
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,

    retryStrategy(times) {
      if (times > 10) {
        logger.warn(
          'Redis: maximum reconnect attempts reached'
        );

        return null;
      }

      return Math.min(
        times * 250,
        2000
      );
    },
  };
}

function createRedisClient() {
  const client =
    new Redis(
      buildRedisOptions()
    );

  client.on(
    'connect',
    () => {
      logger.info(
        'Redis connection established'
      );
    }
  );

  client.on(
    'ready',
    () => {
      redisAvailable = true;

      logger.info(
        'Redis ready'
      );
    }
  );

  client.on(
    'error',
    error => {
      redisAvailable = false;

      if (
        !QUIET_ERROR_CODES.has(
          error.code
        )
      ) {
        logger.error(
          `Redis error: ${error.message}`
        );
      }
    }
  );

  client.on(
    'close',
    () => {
      redisAvailable = false;
    }
  );

  client.on(
    'end',
    () => {
      redisAvailable = false;

      logger.warn(
        'Redis connection ended'
      );
    }
  );

  return client;
}

function getRedisClient() {
  /*
   * An ioredis client in the "end" state cannot be reused.
   */
  if (
    !redisClient
    || redisClient.status === 'end'
  ) {
    redisClient =
      createRedisClient();
  }

  return redisClient;
}

function isRedisAvailable() {
  return redisAvailable;
}

/*
 * Cache failures should not break normal database-backed
 * application features. Security-sensitive callers can inspect
 * the returned success value and fail closed when required.
 */
async function runRedisOperation(
  operation,
  fallbackValue
) {
  try {
    const client =
      getRedisClient();

    /*
     * Issuing this command initiates the connection when the
     * client is currently in lazy "wait" state.
     */
    const result =
      await operation(client);

    redisAvailable =
      client.status === 'ready';

    return result;
  } catch (error) {
    redisAvailable = false;

    if (
      !QUIET_ERROR_CODES.has(
        error.code
      )
    ) {
      logger.warn(
        `Redis operation failed: ${error.message}`
      );
    }

    return fallbackValue;
  }
}

async function cacheGet(key) {
  const serialized =
    await runRedisOperation(
      client =>
        client.get(key),
      null
    );

  if (serialized === null) {
    return null;
  }

  try {
    return JSON.parse(
      serialized
    );
  } catch (error) {
    logger.warn(
      `Redis value for key "${key}" is not valid JSON: ${error.message}`
    );

    return null;
  }
}

async function cacheSet(
  key,
  value,
  ttl =
    parseInt(
      process.env.CACHE_TTL,
      10
    )
    || 300
) {
  const normalizedTtl =
    Math.max(
      1,
      Math.ceil(
        Number(ttl) || 1
      )
    );

  return runRedisOperation(
    async client => {
      const result =
        await client.setex(
          key,
          normalizedTtl,
          JSON.stringify(value)
        );

      return result === 'OK';
    },
    false
  );
}

async function cacheDel(key) {
  return runRedisOperation(
    client =>
      client.del(key),
    0
  );
}

async function cacheDelPattern(
  pattern
) {
  /*
   * SCAN is used instead of KEYS because KEYS can block a
   * production Redis instance when it contains many records.
   */
  return runRedisOperation(
    async client => {
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [
          nextCursor,
          keys,
        ] = await client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );

        cursor = nextCursor;

        if (keys.length > 0) {
          deletedCount +=
            await client.del(
              ...keys
            );
        }
      } while (cursor !== '0');

      return deletedCount;
    },
    0
  );
}

async function cacheExists(key) {
  const result =
    await runRedisOperation(
      client =>
        client.exists(key),
      0
    );

  return result > 0;
}

async function disconnectRedis() {
  if (!redisClient) {
    return;
  }

  const client = redisClient;

  redisClient = null;
  redisAvailable = false;

  try {
    if (
      client.status === 'ready'
    ) {
      await client.quit();
    } else {
      client.disconnect();
    }
  } catch {
    client.disconnect();
  }
}

module.exports = {
  getRedisClient,
  isRedisAvailable,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  cacheExists,
  disconnectRedis,
};