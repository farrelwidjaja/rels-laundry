const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../logger');

const VALID_DEVICE_TYPES = ['Router', 'Switch', 'Server', 'Firewall'];
const VALID_STATUSES = ['Online', 'Warning', 'Offline', 'Maintenance'];

// Helper to validate IPv4 address strictly
function isValidIPv4(ip) {
  if (typeof ip !== 'string') return false;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const num = parseInt(part, 10);
    // Disallow leading zeros for numbers > 0 (e.g. 01)
    if (part.length > 1 && part.startsWith('0')) return false;
    return num >= 0 && num <= 255;
  });
}

// Input validation middleware
function validateNodePayload(req, res, next) {
  const { hostname, ip_address, device_type, port, status, latency_ms, packet_loss } = req.body;
  const errors = [];

  // Hostname validation
  if (!hostname || typeof hostname !== 'string' || hostname.trim().length === 0) {
    errors.push({ field: 'hostname', message: 'Hostname is required.' });
  } else if (hostname.trim().length < 3 || hostname.trim().length > 64) {
    errors.push({ field: 'hostname', message: 'Hostname must be between 3 and 64 characters.' });
  } else if (!/^[a-zA-Z0-9_.-]+$/.test(hostname.trim())) {
    errors.push({
      field: 'hostname',
      message: 'Hostname can only contain alphanumeric characters, hyphens, underscores, and dots.',
    });
  }

  // IP Address validation
  if (!ip_address || typeof ip_address !== 'string' || ip_address.trim().length === 0) {
    errors.push({ field: 'ip_address', message: 'IP address is required.' });
  } else if (!isValidIPv4(ip_address.trim())) {
    errors.push({
      field: 'ip_address',
      message: 'Invalid IPv4 address format. Must be 4 octets between 0 and 255 (e.g., 192.168.1.1).',
    });
  }

  // Device Type validation
  if (!device_type || !VALID_DEVICE_TYPES.includes(device_type)) {
    errors.push({
      field: 'device_type',
      message: `Device type must be one of: ${VALID_DEVICE_TYPES.join(', ')}.`,
    });
  }

  // Port validation
  if (port !== undefined && port !== null && port !== '') {
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      errors.push({ field: 'port', message: 'Port must be an integer between 1 and 65535.' });
    }
  }

  // Status validation
  if (status && !VALID_STATUSES.includes(status)) {
    errors.push({
      field: 'status',
      message: `Status must be one of: ${VALID_STATUSES.join(', ')}.`,
    });
  }

  // Latency validation
  if (latency_ms !== undefined && latency_ms !== null && latency_ms !== '') {
    const lat = Number(latency_ms);
    if (isNaN(lat) || lat < 0) {
      errors.push({ field: 'latency_ms', message: 'Latency must be a non-negative number.' });
    }
  }

  // Packet Loss validation
  if (packet_loss !== undefined && packet_loss !== null && packet_loss !== '') {
    const loss = Number(packet_loss);
    if (isNaN(loss) || loss < 0 || loss > 100) {
      errors.push({ field: 'packet_loss', message: 'Packet loss must be a percentage between 0 and 100.' });
    }
  }

  if (errors.length > 0) {
    logger.warn('Negative input validation triggered', { errors, payload: req.body });
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_FAILED',
      message: 'Input validation failed. Please review the errors below.',
      errors,
    });
  }

  next();
}

// GET /api/nodes - List all nodes and current summary stats
router.get('/', (req, res) => {
  try {
    const nodes = db.getAllNodes();
    const stats = db.getStats();
    return res.json({
      success: true,
      count: nodes.length,
      stats,
      data: nodes,
    });
  } catch (err) {
    logger.error('Failed to retrieve nodes', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message,
    });
  }
});

// GET /api/nodes/:id - Get single node
router.get('/:id', (req, res) => {
  try {
    const node = db.getNodeById(req.params.id);
    if (!node) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Node with ID ${req.params.id} does not exist.`,
      });
    }
    return res.json({ success: true, data: node });
  } catch (err) {
    logger.error(`Failed to retrieve node ${req.params.id}`, { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// POST /api/nodes - Create a new network node
router.post('/', validateNodePayload, (req, res) => {
  try {
    const { hostname, ip_address, device_type, port, status, latency_ms, packet_loss, location } = req.body;

    // Check for duplicate hostname
    const existing = db.getNodeByHostname(hostname.trim());
    if (existing) {
      logger.warn(`Duplicate hostname rejected: ${hostname}`);
      return res.status(409).json({
        success: false,
        error: 'CONFLICT_DUPLICATE_HOSTNAME',
        message: `A device with hostname "${hostname.trim()}" already exists in the infrastructure catalog.`,
      });
    }

    const newNode = db.createNode({
      hostname: hostname.trim(),
      ip_address: ip_address.trim(),
      device_type,
      port: port ? parseInt(port, 10) : 22,
      status: status || 'Online',
      latency_ms: latency_ms !== undefined ? parseFloat(latency_ms) : 12,
      packet_loss: packet_loss !== undefined ? parseFloat(packet_loss) : 0.0,
      uptime: '100.0%',
      location: location ? location.trim() : 'DataCenter-Jakarta-01',
    });

    logger.info(`Node created successfully: ${newNode.hostname}`, { id: newNode.id });
    return res.status(201).json({
      success: true,
      message: `Node [${newNode.hostname}] registered successfully.`,
      data: newNode,
    });
  } catch (err) {
    logger.error('Failed to create node', { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// PUT /api/nodes/:id - Update an existing network node
router.put('/:id', validateNodePayload, (req, res) => {
  try {
    const existing = db.getNodeById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Node with ID ${req.params.id} does not exist.`,
      });
    }

    // Check if new hostname is taken by another node
    const duplicate = db.getNodeByHostname(req.body.hostname.trim());
    if (duplicate && duplicate.id !== existing.id) {
      return res.status(409).json({
        success: false,
        error: 'CONFLICT_DUPLICATE_HOSTNAME',
        message: `Hostname "${req.body.hostname.trim()}" is already assigned to node ID ${duplicate.id}.`,
      });
    }

    const updated = db.updateNode(req.params.id, {
      hostname: req.body.hostname.trim(),
      ip_address: req.body.ip_address.trim(),
      device_type: req.body.device_type,
      port: req.body.port ? parseInt(req.body.port, 10) : existing.port,
      status: req.body.status || existing.status,
      latency_ms: req.body.latency_ms !== undefined ? parseFloat(req.body.latency_ms) : existing.latency_ms,
      packet_loss: req.body.packet_loss !== undefined ? parseFloat(req.body.packet_loss) : existing.packet_loss,
      location: req.body.location ? req.body.location.trim() : existing.location,
    });

    logger.info(`Node updated: ${updated.hostname}`, { id: updated.id });
    return res.json({
      success: true,
      message: `Node [${updated.hostname}] updated successfully.`,
      data: updated,
    });
  } catch (err) {
    logger.error(`Failed to update node ${req.params.id}`, { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// DELETE /api/nodes/:id - Delete a network node
router.delete('/:id', (req, res) => {
  try {
    const deleted = db.deleteNode(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Node with ID ${req.params.id} does not exist.`,
      });
    }

    logger.info(`Node decommissioned and deleted: ${deleted.hostname}`, { id: req.params.id });
    return res.json({
      success: true,
      message: `Node [${deleted.hostname}] has been deleted from persistent storage.`,
      data: deleted,
    });
  } catch (err) {
    logger.error(`Failed to delete node ${req.params.id}`, { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

module.exports = router;
