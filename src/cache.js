const Redis = require('ioredis');
const logger = require('./logger');

let redisClient = null;
let isRedisConnected = false;
const inMemoryCache = new Map();

function initCache() {
  const redisHost = process.env.REDIS_HOST;
  const redisPort = parseInt(process.env.REDIS_PORT, 10) || 6379;

  if (redisHost) {
    try {
      logger.info(`Connecting to Redis cache at ${redisHost}:${redisPort}...`);
      redisClient = new Redis({
        host: redisHost,
        port: redisPort,
        retryStrategy(times) {
          if (times > 3) {
            logger.warn('Redis reconnection limit exceeded. Falling back to in-memory caching.');
            return null; // Stop reconnecting
          }
          return Math.min(times * 500, 2000);
        },
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
      });

      redisClient.on('connect', () => {
        isRedisConnected = true;
        logger.info('Redis cache operational & connected.');
      });

      redisClient.on('error', (err) => {
        isRedisConnected = false;
        logger.warn('Redis connection issue, fallback active:', { error: err.message });
      });
    } catch (err) {
      isRedisConnected = false;
      logger.warn('Could not initialize Redis client, using in-memory cache:', { error: err.message });
    }
  } else {
    logger.info('REDIS_HOST not defined. Operating with high-speed in-memory cache.');
  }
}

async function get(key) {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.warn('Redis GET failure, falling back to in-memory:', { error: err.message });
    }
  }
  const item = inMemoryCache.get(key);
  if (!item) return null;
  if (item.expiresAt && Date.now() > item.expiresAt) {
    inMemoryCache.delete(key);
    return null;
  }
  return item.value;
}

async function set(key, value, ttlSeconds = 60) {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch (err) {
      logger.warn('Redis SET failure, falling back to in-memory:', { error: err.message });
    }
  }
  inMemoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

async function del(key) {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {
      logger.warn('Redis DEL error:', { error: err.message });
    }
  }
  inMemoryCache.delete(key);
}

async function flushPrefix(prefix) {
  if (isRedisConnected && redisClient) {
    try {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (err) {
      logger.warn('Redis flush error:', { error: err.message });
    }
  }
  for (const key of inMemoryCache.keys()) {
    if (key.startsWith(prefix)) {
      inMemoryCache.delete(key);
    }
  }
}

function getCacheStatus() {
  return {
    status: isRedisConnected ? 'CONNECTED' : 'STANDALONE_FALLBACK',
    driver: isRedisConnected ? 'Redis (Cluster/Standalone v7.2)' : 'In-Memory Cache L1',
    keysCount: inMemoryCache.size,
  };
}

// Auto-initialize cache on load
initCache();

module.exports = {
  get,
  set,
  del,
  flushPrefix,
  getCacheStatus,
};
