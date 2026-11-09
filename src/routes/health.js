const express = require('express');
const router = express.Router();
const db = require('../db');
const cache = require('../cache');
const logger = require('../logger');
const config = require('../config');

// /health endpoint - required by cloud services, load balancers, and Docker HEALTHCHECK
router.get('/', (req, res) => {
  const startTime = Date.now();

  try {
    // Probe database connectivity
    const stats = db.getStats();
    const responseTimeMs = Date.now() - startTime;
    const cacheStatus = cache.getCacheStatus();

    const healthData = {
      status: 'UP',
      healthy: true,
      timestamp: new Date().toISOString(),
      service: config.appName,
      version: config.version,
      environment: config.nodeEnv,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: {
        rssMb: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
        heapUsedMb: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
      },
      checks: {
        database: {
          status: 'CONNECTED',
          driver: config.dbType === 'postgres' ? 'PostgreSQL 16 (Multi-Tier Cluster)' : 'SQLite (Persistent Storage)',
          path: config.dbType === 'postgres' ? `${config.dbHost}:${config.dbPort}/${config.dbName}` : config.dbPath,
          totalOrders: stats.totalOrders,
          totalRevenue: stats.totalRevenue,
          latencyMs: responseTimeMs,
        },
        cacheService: {
          status: cacheStatus.status,
          driver: cacheStatus.driver,
          ttlDefault: '60s',
        },
        containerVolume: {
          status: 'PERSISTENT_MOUNTED',
          volume: config.dbType === 'postgres' ? 'postgres_data:/var/lib/postgresql/data' : 'laundry_data:/app/data',
        },
      },
    };

    logger.debug('Health check passed', { responseTimeMs });
    return res.status(200).json(healthData);
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    logger.error('Health check FAILED', { error: err.message, responseTimeMs });

    return res.status(503).json({
      status: 'DOWN',
      healthy: false,
      timestamp: new Date().toISOString(),
      service: config.appName,
      error: err.message,
      checks: {
        database: {
          status: 'DISCONNECTED_OR_DEGRADED',
          error: err.message,
        },
      },
      hint: 'Simulated disruption active or storage unmounted. Check /api/simulate/disrupt status.',
    });
  }
});

// Endpoint to simulate service/database disruption for live university demo
router.post('/simulate/disrupt', (req, res) => {
  const { enable } = req.body;
  const isEnabled = db.setSimulatedFailure(enable ?? true);

  if (isEnabled) {
    logger.warn('DEMO EVENT: Database service disruption has been SIMULATED.');
    db.insertLog('WARN', 'FAULT_INJECTION', 'Injected simulated database failure for demonstration.');
    return res.json({
      success: true,
      simulatedDisruption: true,
      message: 'Database disruption SIMULATED. Subsequent /health checks will return HTTP 503 DOWN.',
    });
  } else {
    logger.info('DEMO EVENT: Database service recovered to NORMAL.');
    db.insertLog('INFO', 'FAULT_INJECTION', 'Recovered database service to healthy state.');
    return res.json({
      success: true,
      simulatedDisruption: false,
      message: 'Database service restored to NORMAL. Subsequent /health checks will return HTTP 200 UP.',
    });
  }
});

module.exports = router;
