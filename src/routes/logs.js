const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../logger');

// GET /api/logs - Fetch recent audit and telemetry logs
router.get('/', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const logs = db.getRecentLogs(limit);
    return res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (err) {
    logger.error('Failed to retrieve system logs', { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// POST /api/logs/simulate-ping - Trigger live network telemetry ping simulation
router.post('/simulate-ping', (req, res) => {
  try {
    const nodes = db.getAllNodes();
    if (nodes.length === 0) {
      return res.json({ success: true, message: 'No nodes registered to ping.' });
    }

    // Pick random node to simulate ping telemetry
    const target = nodes[Math.floor(Math.random() * nodes.length)];
    const pingFluctuation = Math.floor(Math.random() * 8) - 4;
    const newLatency = Math.max(2, target.latency_ms + pingFluctuation);

    db.updateNode(target.id, { latency_ms: newLatency });
    const logMsg = `ICMP Ping response from [${target.hostname}] (${target.ip_address}): time=${newLatency}ms ttl=64`;
    db.insertLog('INFO', 'ICMP_PROBE', logMsg);

    return res.json({
      success: true,
      message: logMsg,
      node: target.hostname,
      latency: newLatency,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

module.exports = router;
