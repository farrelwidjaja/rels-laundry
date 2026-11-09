const config = require('./config');

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevelNum = LEVELS[config.logLevel.toLowerCase()] ?? 1;

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  return JSON.stringify({
    timestamp,
    level: level.toUpperCase(),
    service: 'noc-api',
    message,
    ...meta,
  });
}

const logger = {
  debug(message, meta) {
    if (currentLevelNum <= LEVELS.debug) {
      console.log(`\x1b[36m[DEBUG]\x1b[0m ${formatLog('debug', message, meta)}`);
    }
  },
  info(message, meta) {
    if (currentLevelNum <= LEVELS.info) {
      console.log(`\x1b[32m[INFO]\x1b[0m ${formatLog('info', message, meta)}`);
    }
  },
  warn(message, meta) {
    if (currentLevelNum <= LEVELS.warn) {
      console.warn(`\x1b[33m[WARN]\x1b[0m ${formatLog('warn', message, meta)}`);
    }
  },
  error(message, meta) {
    if (currentLevelNum <= LEVELS.error) {
      console.error(`\x1b[31m[ERROR]\x1b[0m ${formatLog('error', message, meta)}`);
    }
  },
  // Stream interface for Morgan HTTP logger
  httpStream: {
    write(message) {
      logger.info('HTTP Request', { http: message.trim() });
    },
  },
};

module.exports = logger;
