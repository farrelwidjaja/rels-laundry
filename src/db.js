const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

let dbInstance = null;
let simulatedFailure = false;

// Pricing rates per service
const PRICING_RATES = {
  'Cuci Komplit (Cuci + Setrika)': 8000,
  'Cuci Kering (Lipat)': 6000,
  'Setrika Saja': 5000,
  'Express 3 Jam': 15000,
  'Bedcover / Selimut': 25000,
};

function getDb() {
  if (simulatedFailure) {
    throw new Error('SIMULATED_DB_DISRUPTION: Database connection severed or storage pool unavailable');
  }

  if (!dbInstance) {
    logger.info(`Initializing SQLite storage at: ${config.dbPath}`);
    dbInstance = new DatabaseSync(config.dbPath);
    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db) {
  // Table: Laundry Orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      service_type TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      price_per_kg INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Antrian',
      pickup_delivery TEXT DEFAULT 'Ambil Sendiri',
      delivery_time TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Table: WhatsApp Bot Chats
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      order_code TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Table: System & Audit Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Auto-seed initial orders if table is empty
  const countRow = db.prepare('SELECT COUNT(*) AS total FROM orders').get();
  if (countRow.total === 0) {
    logger.info('Database empty. Seeding initial laundry orders and WhatsApp chat logs...');
    
    const seedOrders = [
      ['WASH-1001', 'Ibu Sri Rahayu', '081234567890', 'Cuci Komplit (Cuci + Setrika)', 4.5, 8000, 36000, 'Proses Cuci', 'Ambil Sendiri', '16:00', 'Dua gamis jangan disikat keras'],
      ['WASH-1002', 'Budi Santoso', '081398765432', 'Express 3 Jam', 3.0, 15000, 45000, 'Selesai', 'Kurir Antar-Jemput', '14:00', 'Pakaian kerja urgent'],
      ['WASH-1003', 'Dewi Lestari', '085612349876', 'Cuci Kering (Lipat)', 6.2, 6000, 37200, 'Antrian', 'Ambil Sendiri', 'Besok', 'Pisahkan pakaian putih dan luntur'],
      ['WASH-1004', 'dr. Kevin Pratama', '081122334455', 'Cuci Komplit (Cuci + Setrika)', 5.0, 8000, 40000, 'Setrika', 'Kurir Antar-Jemput', '17:30', 'Jas dokter harap digantung rapi'],
      ['WASH-1005', 'Rina Wulandari', '087811223344', 'Bedcover / Selimut', 1.0, 25000, 25000, 'Selesai', 'Ambil Sendiri', 'Siap Ambil', 'Harum aroma Lavender'],
      ['WASH-1006', 'Ahmad Fauzi', '089677889900', 'Setrika Saja', 4.0, 5000, 20000, 'Antrian', 'Ambil Sendiri', 'Lusa', 'Kemeja kantor disetrika licin'],
    ];

    const insertStmt = db.prepare(`
      INSERT INTO orders (order_code, customer_name, customer_phone, service_type, weight_kg, price_per_kg, total_price, status, pickup_delivery, delivery_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const o of seedOrders) {
      insertStmt.run(...o);
    }

    // Seed initial WhatsApp Bot conversation
    const chatStmt = db.prepare(`
      INSERT INTO chat_logs (sender, phone, message, order_code)
      VALUES (?, ?, ?, ?)
    `);
    chatStmt.run('CUSTOMER', '081398765432', 'Kak, cucian saya atas nama Budi order WASH-1002 udah selesai belum ya?', 'WASH-1002');
    chatStmt.run('BOT', '081398765432', 'Halo Kak Budi Santoso! 👋 Cucian Anda [#WASH-1002] (Express 3 Jam) saat ini berstatus: ✅ SELESAI & WANGI. Paket siap diantar kurir jam 14:00. Total: Rp 45.000. Terima kasih!', 'WASH-1002');
    chatStmt.run('CUSTOMER', '085612349876', 'Halo mau tanya daftar harga paket laundry apa aja?', null);
    chatStmt.run('BOT', '085612349876', 'Halo kak! Berikut daftar harga Rels Laundry:\n1. Cuci Komplit: Rp 8.000/kg\n2. Cuci Kering (Lipat): Rp 6.000/kg\n3. Setrika Saja: Rp 5.000/kg\n4. Express 3 Jam: Rp 15.000/kg\n5. Bedcover: Rp 25.000/pcs\nAntar-jemput gratis min. 5 kg!', null);

    // Seed system log
    const logStmt = db.prepare(`INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)`);
    logStmt.run('INFO', 'SYSTEM', 'Persistent SQLite storage initialized for Rels Laundry POS.');
    logStmt.run('INFO', 'WA_BOT', 'WhatsApp Automation Webhook listener ready.');
    logStmt.run('INFO', 'POS_ENGINE', 'Label printing and weighting scale integration active.');

    logger.info('Rels Laundry initial orders and WhatsApp bot conversations seeded successfully.');
  }
}

// Data Access Object
const dbOperations = {
  PRICING_RATES,
  getDbInstance: getDb,

  setSimulatedFailure(state) {
    simulatedFailure = Boolean(state);
    return simulatedFailure;
  },

  getSimulatedFailureState() {
    return simulatedFailure;
  },

  // Orders CRUD
  getAllOrders() {
    const db = getDb();
    return db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  },

  getOrderById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  },

  getOrderByCode(code) {
    const db = getDb();
    return db.prepare('SELECT * FROM orders WHERE order_code = ? COLLATE NOCASE').get(code.trim());
  },

  searchOrders(keyword) {
    const db = getDb();
    const query = `%${keyword.trim()}%`;
    return db.prepare(`
      SELECT * FROM orders 
      WHERE order_code LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?
      ORDER BY id DESC
    `).all(query, query, query);
  },

  createOrder(data) {
    const db = getDb();
    const {
      customer_name,
      customer_phone,
      service_type,
      weight_kg,
      pickup_delivery = 'Ambil Sendiri',
      delivery_time = 'Sesuai Jadwal',
      notes = '',
    } = data;

    // Calculate price
    const rate = PRICING_RATES[service_type] || 8000;
    const total_price = Math.round(weight_kg * rate);

    // Generate unique order code (WASH-1000 + next ID)
    const lastRow = db.prepare('SELECT MAX(id) AS max_id FROM orders').get();
    const nextId = (lastRow.max_id || 0) + 1;
    const order_code = `WASH-${1000 + nextId}`;

    const stmt = db.prepare(`
      INSERT INTO orders (order_code, customer_name, customer_phone, service_type, weight_kg, price_per_kg, total_price, status, pickup_delivery, delivery_time, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Antrian', ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      order_code,
      customer_name.trim(),
      customer_phone.trim(),
      service_type,
      weight_kg,
      rate,
      total_price,
      pickup_delivery,
      delivery_time,
      notes.trim()
    );

    const newOrder = this.getOrderById(result.lastInsertRowid);
    this.insertLog('INFO', 'POS_ORDER', `Created order [${order_code}] for ${customer_name} (${weight_kg}kg, Rp ${total_price})`);

    // Automatic WhatsApp Notification on order creation
    this.insertChat(
      'BOT',
      customer_phone,
      `Halo Kak ${customer_name}! Order laundry Anda [#${order_code}] berhasil dicatat. Layanan: ${service_type} (${weight_kg} kg). Total: Rp ${total_price.toLocaleString('id-ID')}. Kami beri tahu jika cucian sudah siap ya!`,
      order_code
    );

    return newOrder;
  },

  updateOrder(id, data) {
    const db = getDb();
    const existing = this.getOrderById(id);
    if (!existing) return null;

    const customer_name = data.customer_name ?? existing.customer_name;
    const customer_phone = data.customer_phone ?? existing.customer_phone;
    const service_type = data.service_type ?? existing.service_type;
    const weight_kg = data.weight_kg !== undefined ? parseFloat(data.weight_kg) : existing.weight_kg;
    const rate = PRICING_RATES[service_type] || existing.price_per_kg;
    const total_price = Math.round(weight_kg * rate);
    const status = data.status ?? existing.status;
    const pickup_delivery = data.pickup_delivery ?? existing.pickup_delivery;
    const delivery_time = data.delivery_time ?? existing.delivery_time;
    const notes = data.notes ?? existing.notes;

    const stmt = db.prepare(`
      UPDATE orders
      SET customer_name = ?, customer_phone = ?, service_type = ?, weight_kg = ?, price_per_kg = ?,
          total_price = ?, status = ?, pickup_delivery = ?, delivery_time = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      customer_name,
      customer_phone,
      service_type,
      weight_kg,
      rate,
      total_price,
      status,
      pickup_delivery,
      delivery_time,
      notes,
      id
    );

    this.insertLog('INFO', 'POS_ORDER', `Updated order [${existing.order_code}] Status: ${status}`);
    return this.getOrderById(id);
  },

  deleteOrder(id) {
    const db = getDb();
    const existing = this.getOrderById(id);
    if (!existing) return null;

    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    this.insertLog('WARN', 'POS_ORDER', `Deleted order [${existing.order_code}] ID: ${id}`);
    return existing;
  },

  // WhatsApp Chat Logs
  getChatLogs(limit = 30) {
    const db = getDb();
    return db.prepare('SELECT * FROM chat_logs ORDER BY id DESC LIMIT ?').all(limit).reverse();
  },

  insertChat(sender, phone, message, order_code = null) {
    try {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO chat_logs (sender, phone, message, order_code)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(sender.toUpperCase(), phone, message, order_code);
    } catch (err) {
      logger.warn(`Could not save chat: ${err.message}`);
    }
  },

  // System Logs
  getRecentLogs(limit = 40) {
    const db = getDb();
    return db.prepare('SELECT * FROM system_logs ORDER BY id DESC LIMIT ?').all(limit);
  },

  insertLog(level, source, message) {
    try {
      const db = getDb();
      db.prepare('INSERT INTO system_logs (level, source, message) VALUES (?, ?, ?)')
        .run(level.toUpperCase(), source.toUpperCase(), message);
    } catch (err) {
      logger.warn(`Could not save system log: ${err.message}`);
    }
  },

  // Comprehensive Business & System Stats
  getStats() {
    const db = getDb();
    const totalRow = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS revenue, COALESCE(SUM(weight_kg), 0) AS total_kg FROM orders').get();
    const activeRow = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('Antrian', 'Proses Cuci', 'Setrika')").get();
    const paidRow = db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS paid_revenue FROM orders WHERE status IN ('Selesai', 'Diambil / Diantar')").get();
    const chatsRow = db.prepare('SELECT COUNT(*) AS count FROM chat_logs').get();

    const totalKg = Math.round((totalRow.total_kg || 0) * 10) / 10;
    const paidRevenue = paidRow.paid_revenue || 0;
    const totalOrders = totalRow.count || 0;
    const activeOrders = activeRow.count || 0;
    const doneOrders = paidRow.count || 0;
    const totalChats = chatsRow.count || 0;

    return {
      totalOrders,
      totalRevenue: totalRow.revenue || 0,
      paidRevenue,
      totalKg,
      activeOrders,
      doneOrders,
      totalChats,
      databaseStatus: 'HEALTHY_CONNECTED',
      simulatedDisruption: simulatedFailure,

      total_orders: totalOrders,
      total_revenue: totalRow.revenue || 0,
      paid_revenue: paidRevenue,
      total_weight_kg: totalKg,
      active_orders: activeOrders,
      done_orders: doneOrders,
      total_chats: totalChats,
    };
  },
};

module.exports = dbOperations;
