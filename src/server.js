const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const config = require('./config');
const logger = require('./logger');
const db = require('./db');

const healthRouter = require('./routes/health');
const ordersRouter = require('./routes/orders');
const whatsappRouter = require('./routes/whatsapp');
const logsRouter = require('./routes/logs');

const app = express();

// Middleware: CORS & Body Parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: HTTP Logging via Morgan
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    stream: logger.httpStream,
  })
);

// Healthcheck Route (First-class citizen for Docker & Cloud orchestrators)
app.use('/health', healthRouter);

// REST API Endpoints
app.use('/api/orders', ordersRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/logs', logsRouter);

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, 'public')));

// 404 Handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API_ENDPOINT_NOT_FOUND',
    message: `Resource [${req.method}] ${req.originalUrl} does not exist.`,
  });
});

// SPA fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled Server Exception', {
    error: err.message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
  });

  res.status(err.status || 500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected server error occurred.',
  });
});

// Initialize database before starting server
try {
  db.getDbInstance();
  logger.info('Database initialized and connected successfully.');
} catch (err) {
  logger.error('Fatal: Could not initialize database storage', { error: err.message });
}

// Start Server Listener (only when not running as a Vercel serverless function)
let server;
if (!process.env.VERCEL) {
  server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`
  ==============================================================
   _  _  ___   ____   ___            _     _                     _ 
  | \\| |/ _ \\ / ___| |   \\ __ _ ___| |_  | |__  ___  __ _ _ _ __| |
  | .\` | (_) | |___  | |) / _\` (_-< ' \\ | '_ \\/ _ \\/ _\` | '_/ _\` |
  |_|\\_|\\___/ \\____| |___/\\__,_/__/_||_|_.__/\\___/\\__,_|_| \\__,_|
  ==============================================================
  * Service Name : ${config.appName} (v${config.version})
  * Environment  : ${config.nodeEnv}
  * HTTP Port    : http://localhost:${config.port}
  * Healthcheck  : http://localhost:${config.port}/health
  * Database     : ${config.dbPath} (Persistent)
  * Container ID : ${process.env.HOSTNAME || 'local-host'}
  ==============================================================
    `);
    logger.info(`Server operational on http://0.0.0.0:${config.port}`);
  });

  // Graceful Shutdown for Container Lifecycle (SIGTERM/SIGINT)
  function handleShutdown(signal) {
    logger.info(`Received ${signal}. Gracefully stopping HTTP server and closing connections...`);
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed. Exiting process safely.');
        process.exit(0);
      });
    }

    // Force exit if connections do not close within 5 seconds
    setTimeout(() => {
      logger.warn('Forcing server shutdown after timeout.');
      process.exit(1);
    }, 5000);
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

module.exports = app;
