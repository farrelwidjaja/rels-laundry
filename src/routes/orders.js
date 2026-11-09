const express = require('express');
const router = express.Router();
const db = require('../db');
const cache = require('../cache');
const logger = require('../logger');

const VALID_STATUSES = ['Antrian', 'Proses Cuci', 'Setrika', 'Selesai', 'Diambil / Diantar'];

// Phone format validator (accepts 08xxx, 628xxx, +628xxx)
function isValidIndonesianPhone(phone) {
  if (typeof phone !== 'string') return false;
  const clean = phone.replace(/[\s-]/g, '');
  return /^(?:\+62|62|08)[0-9]{8,13}$/.test(clean);
}

// Input validation middleware for orders
function validateOrderPayload(req, res, next) {
  const { customer_name, customer_phone, service_type, weight_kg, status } = req.body;
  const errors = [];

  // Customer Name
  if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length === 0) {
    errors.push({ field: 'customer_name', message: 'Nama pelanggan wajib diisi.' });
  } else if (customer_name.trim().length < 2 || customer_name.trim().length > 64) {
    errors.push({ field: 'customer_name', message: 'Nama pelanggan harus antara 2 hingga 64 karakter.' });
  }

  // Customer Phone
  if (!customer_phone || typeof customer_phone !== 'string' || customer_phone.trim().length === 0) {
    errors.push({ field: 'customer_phone', message: 'Nomor WhatsApp pelanggan wajib diisi.' });
  } else if (!isValidIndonesianPhone(customer_phone.trim())) {
    errors.push({
      field: 'customer_phone',
      message: 'Format nomor WhatsApp tidak valid. Gunakan awalan 08xxx atau 628xxx (contoh: 081234567890).',
    });
  }

  // Service Type
  if (!service_type || !db.PRICING_RATES[service_type]) {
    errors.push({
      field: 'service_type',
      message: `Jenis paket layanan tidak valid. Pilihan: ${Object.keys(db.PRICING_RATES).join(', ')}.`,
    });
  }

  // Weight (Kg)
  if (weight_kg === undefined || weight_kg === null || weight_kg === '') {
    errors.push({ field: 'weight_kg', message: 'Berat cucian (Kg) wajib diisi.' });
  } else {
    const w = Number(weight_kg);
    if (isNaN(w) || w <= 0) {
      errors.push({ field: 'weight_kg', message: 'Berat cucian harus berupa angka positif lebih besar dari 0 Kg.' });
    } else if (w > 500) {
      errors.push({ field: 'weight_kg', message: 'Berat cucian maksimal 500 Kg per nota order.' });
    }
  }

  // Status (optional on create, validated on update)
  if (status && !VALID_STATUSES.includes(status)) {
    errors.push({
      field: 'status',
      message: `Status cucian harus salah satu dari: ${VALID_STATUSES.join(', ')}.`,
    });
  }

  if (errors.length > 0) {
    logger.warn('Negative input validation triggered on /api/orders', { errors, payload: req.body });
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_FAILED',
      message: 'Input data order tidak valid. Silakan periksa pesan kesalahan di bawah.',
      errors,
    });
  }

  next();
}

// GET /api/orders - List all orders and business stats (Redis/In-Memory Cached)
router.get('/', async (req, res) => {
  try {
    const cacheKey = 'orders:all';
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        cached: true,
      });
    }

    const orders = db.getAllOrders();
    const stats = db.getStats();
    const payload = {
      success: true,
      count: orders.length,
      stats,
      data: orders,
      pricingRates: db.PRICING_RATES,
    };

    // Store in cache for 30 seconds
    await cache.set(cacheKey, payload, 30);
    return res.json({
      ...payload,
      cached: false,
    });
  } catch (err) {
    logger.error('Failed to retrieve orders', { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// GET /api/orders/:id - Get single order details
router.get('/:id', (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Order dengan ID ${req.params.id} tidak ditemukan.`,
      });
    }
    return res.json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// POST /api/orders - Create new laundry order (Sistem Kasir & Label)
router.post('/', validateOrderPayload, async (req, res) => {
  try {
    const { customer_name, customer_phone, service_type, weight_kg, pickup_delivery, delivery_time, notes } = req.body;

    const newOrder = db.createOrder({
      customer_name,
      customer_phone,
      service_type,
      weight_kg: parseFloat(weight_kg),
      pickup_delivery: pickup_delivery || 'Ambil Sendiri',
      delivery_time: delivery_time || 'Sesuai Jadwal',
      notes: notes || '',
    });

    // Invalidate orders cache
    await cache.del('orders:all');

    return res.status(201).json({
      success: true,
      message: `Nota [#${newOrder.order_code}] berhasil dibuat & label dicetak.`,
      data: newOrder,
    });
  } catch (err) {
    logger.error('Failed to create order', { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// PATCH /api/orders/:id/status - Quick status update from table dropdown
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const existing = db.getOrderById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Order dengan ID ${req.params.id} tidak ditemukan.`,
      });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: `Status tidak valid. Pilihan status: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    const updated = db.updateOrder(req.params.id, { status });
    await cache.del('orders:all');

    return res.json({
      success: true,
      message: `Status order [#${updated.order_code}] berhasil diperbarui menjadi "${updated.status}".`,
      data: updated,
    });
  } catch (err) {
    logger.error(`Failed to update status for order ${req.params.id}`, { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// PATCH /api/orders/:id - Partial update of order
router.patch('/:id', async (req, res) => {
  try {
    const existing = db.getOrderById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Order dengan ID ${req.params.id} tidak ditemukan.`,
      });
    }

    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: `Status tidak valid. Pilihan: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    const updated = db.updateOrder(req.params.id, req.body);
    await cache.del('orders:all');

    return res.json({
      success: true,
      message: `Order [#${updated.order_code}] berhasil diperbarui.`,
      data: updated,
    });
  } catch (err) {
    logger.error(`Failed to patch order ${req.params.id}`, { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// PUT /api/orders/:id - Update order or status (Triggers WhatsApp notification on status change)
router.put('/:id', async (req, res) => {
  try {
    const existing = db.getOrderById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Order dengan ID ${req.params.id} tidak ditemukan.`,
      });
    }

    // Validate status if provided
    if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: `Status tidak valid. Pilihan: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    const updated = db.updateOrder(req.params.id, req.body);
    await cache.del('orders:all');

    return res.json({
      success: true,
      message: `Status order [#${updated.order_code}] berhasil diperbarui menjadi "${updated.status}".`,
      data: updated,
    });
  } catch (err) {
    logger.error(`Failed to update order ${req.params.id}`, { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// DELETE /api/orders/:id - Delete laundry order
router.delete('/:id', async (req, res) => {
  try {
    const deleted = db.deleteOrder(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Order dengan ID ${req.params.id} tidak ditemukan.`,
      });
    }

    await cache.del('orders:all');

    return res.json({
      success: true,
      message: `Order [#${deleted.order_code}] berhasil dihapus dari database.`,
      data: deleted,
    });
  } catch (err) {
    logger.error(`Failed to delete order ${req.params.id}`, { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

module.exports = router;
