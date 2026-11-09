// Automated Testing Suite for WashFlow Laundry POS & WhatsApp Bot Platform
const assert = require('assert');
const http = require('http');

const PORT = process.env.TEST_PORT || 3099;
process.env.PORT = PORT;
process.env.DB_PATH = './data/test_laundry.db';

const app = require('../src/server');

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            resolve({ statusCode: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: rawData });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('>>> RUNNING WASHFLOW LAUNDRY POS TEST SUITE <<<');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`\x1b[32m✔ PASS:\x1b[0m ${name}`);
      passed++;
    } catch (err) {
      console.error(`\x1b[31m✘ FAIL:\x1b[0m ${name}`);
      console.error(`       Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Healthcheck Test
  await test('GET /health returns HTTP 200 with persistent database checks', async () => {
    const res = await makeRequest('/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.status, 'UP');
    assert.strictEqual(res.data.healthy, true);
    assert.strictEqual(res.data.checks.database.status, 'CONNECTED');
  });

  // 2. Fetch Orders List Test
  await test('GET /api/orders returns seeded laundry orders and pricing rates', async () => {
    const res = await makeRequest('/api/orders');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.data));
    assert.ok(res.data.data.length >= 6, 'Expected at least 6 initial seeded orders');
    assert.ok(res.data.pricingRates['Cuci Komplit (Cuci + Setrika)'] === 8000);
  });

  // 3. Positive Create Laundry Order Test (POST)
  let createdOrderId = null;
  await test('POST /api/orders creates new laundry order with price calculation & unique code', async () => {
    const validOrder = {
      customer_name: 'Siti Aminah',
      customer_phone: '081299887766',
      service_type: 'Cuci Komplit (Cuci + Setrika)',
      weight_kg: 5.0,
      pickup_delivery: 'Ambil Sendiri',
      notes: 'Wangi floral',
    };
    const res = await makeRequest('/api/orders', 'POST', validOrder);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.customer_name, 'Siti Aminah');
    assert.strictEqual(res.data.data.total_price, 40000); // 5.0 * 8000
    assert.ok(res.data.data.order_code.startsWith('WASH-'));
    createdOrderId = res.data.data.id;
  });

  // 4. Negative Input Validation Tests (HTTP 400 Bad Request)
  await test('Negative Test: POST /api/orders rejects negative weight with HTTP 400', async () => {
    const invalidWeightOrder = {
      customer_name: 'Test Customer',
      customer_phone: '081234567890',
      service_type: 'Cuci Komplit (Cuci + Setrika)',
      weight_kg: -4.5, // Negative weight
    };
    const res = await makeRequest('/api/orders', 'POST', invalidWeightOrder);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.error, 'VALIDATION_FAILED');
    assert.ok(res.data.errors.some((e) => e.field === 'weight_kg'));
  });

  await test('Negative Test: POST /api/orders rejects invalid phone format with HTTP 400', async () => {
    const invalidPhoneOrder = {
      customer_name: 'Test Customer',
      customer_phone: '12345', // Invalid phone
      service_type: 'Cuci Komplit (Cuci + Setrika)',
      weight_kg: 3.0,
    };
    const res = await makeRequest('/api/orders', 'POST', invalidPhoneOrder);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.errors.some((e) => e.field === 'customer_phone'));
  });

  // 5. Update Order Status & Trigger Automated WhatsApp Notif (PUT & PATCH)
  await test('PATCH /api/orders/:id/status updates status and bot detects new status', async () => {
    assert.ok(createdOrderId);
    const patchRes = await makeRequest(`/api/orders/${createdOrderId}/status`, 'PATCH', { status: 'Proses Cuci' });
    assert.strictEqual(patchRes.statusCode, 200);
    assert.strictEqual(patchRes.data.data.status, 'Proses Cuci');

    // Bot query by customer name detects the updated status
    const botCheck = await makeRequest('/api/whatsapp/chat', 'POST', {
      message: 'status cucian atas nama Siti Aminah gimana ya?',
      phone: '081299887766'
    });
    assert.strictEqual(botCheck.statusCode, 200);
    assert.ok(botCheck.data.reply.includes('PROSES CUCI'));
  });

  await test('PUT /api/orders/:id updates status to "Selesai" and triggers WhatsApp notification', async () => {
    assert.ok(createdOrderId);
    const updatePayload = {
      status: 'Selesai',
    };
    const res = await makeRequest(`/api/orders/${createdOrderId}`, 'PUT', updatePayload);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.data.status, 'Selesai');
  });

  // 6. WhatsApp Bot Interactive Chat Tests (POST /api/whatsapp/chat)
  await test('POST /api/whatsapp/chat responds automatically to order status check (#WASH-1002)', async () => {
    const chatPayload = {
      message: 'Kak, cucian saya nomor WASH-1002 udah selesai belum ya?',
      phone: '081398765432',
    };
    const res = await makeRequest('/api/whatsapp/chat', 'POST', chatPayload);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.reply.includes('Budi Santoso'));
    assert.ok(res.data.reply.includes('SELESAI'));
    assert.strictEqual(res.data.order_code, 'WASH-1002');
  });

  await test('POST /api/whatsapp/chat responds with price list when asked "harga"', async () => {
    const chatPayload = {
      message: 'Halo mau tanya daftar harga paket laundry kiloan apa aja ya?',
      phone: '081234567890',
    };
    const res = await makeRequest('/api/whatsapp/chat', 'POST', chatPayload);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.data.reply.includes('Cuci Komplit'));
    assert.ok(res.data.reply.includes('8.000'));
  });

  // 7. Delete Order Test (DELETE)
  await test('DELETE /api/orders/:id removes order from database', async () => {
    assert.ok(createdOrderId);
    const res = await makeRequest(`/api/orders/${createdOrderId}`, 'DELETE');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);

    const checkRes = await makeRequest(`/api/orders/${createdOrderId}`);
    assert.strictEqual(checkRes.statusCode, 404);
  });

  // 8. Service Disruption Fault Injection Test (HTTP 503)
  await test('Fault Injection: Triggering DB disruption causes /health to return HTTP 503 DOWN', async () => {
    await makeRequest('/health/simulate/disrupt', 'POST', { enable: true });

    const healthRes = await makeRequest('/health');
    assert.strictEqual(healthRes.statusCode, 503);
    assert.strictEqual(healthRes.data.status, 'DOWN');
    assert.strictEqual(healthRes.data.healthy, false);

    // Recover
    await makeRequest('/health/simulate/disrupt', 'POST', { enable: false });

    const recovered = await makeRequest('/health');
    assert.strictEqual(recovered.statusCode, 200);
    assert.strictEqual(recovered.data.status, 'UP');
  });

  console.log('\n------------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('------------------------------------------------------\n');

  process.exit(failed > 0 ? 1 : 0);
}

setTimeout(runTestSuite, 500);
