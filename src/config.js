const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env if present
dotenv.config();

const isVercel = Boolean(process.env.VERCEL);
const defaultDbPath = isVercel
  ? path.join('/tmp', 'laundry.db')
  : path.join(__dirname, '..', 'data', 'laundry.db');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'production',
  dbType: process.env.DB_TYPE || (process.env.DB_HOST ? 'postgres' : 'sqlite'),
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: parseInt(process.env.DB_PORT, 10) || 5432,
  dbUser: process.env.POSTGRES_USER || process.env.DB_USER || 'rels_user',
  dbPassword: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'rels_secure_password_2026',
  dbName: process.env.POSTGRES_DB || process.env.DB_NAME || 'rels_laundry_db',
  dbPath: process.env.DB_PATH || defaultDbPath,
  redisHost: process.env.REDIS_HOST || null,
  redisPort: parseInt(process.env.REDIS_PORT, 10) || 6379,
  logLevel: process.env.LOG_LEVEL || 'info',
  appName: process.env.APP_NAME || 'Rels Laundry Cloud — Smart Laundry POS & WhatsApp Bot Platform',
  version: process.env.SERVICE_VERSION || '1.0.0',
};

// Ensure data directory for persistent SQLite exists
const dbDir = path.dirname(path.resolve(config.dbPath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

module.exports = config;
