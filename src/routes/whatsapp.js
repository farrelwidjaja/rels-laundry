const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../logger');

// Helper to format detailed, real-time status responses
function formatOrderStatusResponse(order) {
  const statusEmoji = {
    'Antrian': '⏳ [SEDANG MENUNGGU ANTRIAN]',
    'Proses Cuci': '🫧 [SEDANG PROSES CUCI DALAM MESIN]',
    'Setrika': '👔 [SEDANG PROSES SETRIKA & DILIPAT RAPI]',
    'Selesai': '✅ [SUDAH SELESAI & WANGI]',
    'Diambil / Diantar': '🛵 [SUDAH DIAMBIL / DIANTAR KURIR]',
  }[order.status] || order.status;

  let progressDetail = '';
  if (order.status === 'Antrian') {
    progressDetail = `⏳ Cucian Anda saat ini sedang dalam *ANTRIAN* pengerjaan. Tim kami akan segera memasukkannya ke mesin cuci!`;
  } else if (order.status === 'Proses Cuci') {
    progressDetail = `🫧 Cucian Anda saat ini sedang *DICUCI BERSIH* di dalam mesin cuci dengan detergen ramah serat & pewangi premium.`;
  } else if (order.status === 'Setrika') {
    progressDetail = `👔 Cucian Anda sudah selesai dicuci dan saat ini sedang *DISETRIKA UAP* rapi serta dilipat wangi anti-lecek!`;
  } else if (order.status === 'Selesai') {
    progressDetail = `✅ Kabar gembira! Cucian Anda sudah *SELESAI*, wangi, rapi, dan siap diambil atau diantar ke rumah!`;
  } else if (order.status === 'Diambil / Diantar') {
    progressDetail = `🛵 Cucian ini telah *DIAMBIL OLEH PELANGGAN / DIANTAR KURIR*. Terima kasih atas kepercayaannya!`;
  } else {
    progressDetail = `Status pengerjaan cucian: *${order.status}*.`;
  }

  let reply = `Halo Kak ${order.customer_name}! 👋\n\n`;
  reply += `Update status cucian Anda dengan nomor nota *[#${order.order_code}]*:\n`;
  reply += `📌 Status Terkini: *${statusEmoji}*\n`;
  reply += `ℹ️ Keterangan: ${progressDetail}\n`;
  reply += `🧺 Paket Layanan: ${order.service_type} (${order.weight_kg} Kg)\n`;
  reply += `💰 Total Tagihan: Rp ${order.total_price.toLocaleString('id-ID')}\n`;
  reply += `🛵 Metode: ${order.pickup_delivery} (Jadwal: ${order.delivery_time || 'Hari ini'})\n\n`;

  if (order.status === 'Selesai') {
    reply += `Pakaian Anda sudah harum dan siap pakai! Silakan ambil di outlet atau balas chat ini jika ingin diantar kurir ke rumah Anda ya kak. 🧺✨`;
  } else if (order.status === 'Diambil / Diantar') {
    reply += `Semoga pakaian Anda wangi dan nyaman dipakai. Ditunggu cucian berikutnya di Rels Laundry! 🙏✨`;
  } else {
    reply += `Pengerjaan dilakukan dengan teliti dan higienis. Setiap perubahan status akan otomatis terupdate di sini ya kak! 🙏`;
  }

  return { reply, order_code: order.order_code };
}

// Natural Language / Keyword Intent Processor for WhatsApp Bot
function processCustomerInquiry(message, phone = '081200000000') {
  const cleanMsg = message.trim();
  const lower = cleanMsg.toLowerCase();

  // 1. Intent: Order Status Check by Code (e.g. WASH-1001, WASH1001, #1001, or 1001)
  const codeMatch = cleanMsg.match(/(?:WASH-?|#)(\d{4})/i) || cleanMsg.match(/\b(1\d{3})\b/);
  if (codeMatch) {
    const codeNum = codeMatch[1];
    const orderCode = `WASH-${codeNum}`;
    const order = db.getOrderByCode(orderCode);

    if (order) {
      return formatOrderStatusResponse(order);
    } else {
      return {
        reply: `Halo kak! Nomor nota *#${orderCode}* tidak ditemukan di sistem database kami. Mohon cek kembali struk atau label cucian Anda ya kak. 🙏`,
        order_code: orderCode,
      };
    }
  }

  // 2. Intent: Order Status Check by Customer Name or Customer Phone
  // E.g., "cek cucian budi", "atas nama farrel", "status pesanan saya", "cucian atas nama siti", or just customer name "farrel"
  const allOrders = db.getAllOrders();
  const matchedOrder = allOrders.find(o => {
    const nameParts = o.customer_name.toLowerCase().split(/\s+/);
    return nameParts.some(part => part.length >= 3 && lower.includes(part));
  });

  if (matchedOrder && (
    lower.includes('cek') || lower.includes('status') || lower.includes('pesanan') ||
    lower.includes('cucian') || lower.includes('nama') || lower.includes('laundry') ||
    lower.includes('baju') || lower.includes('order') || lower.includes('gimana') ||
    lower.includes('sudah') || lower.includes('udah') || lower.includes('kapan') ||
    lower.trim() === matchedOrder.customer_name.toLowerCase()
  )) {
    return formatOrderStatusResponse(matchedOrder);
  }

  // 3. Intent: Specific Service & Pricing Inquiries
  // Specific: Cuci Komplit
  if (lower.includes('komplit') || (lower.includes('cuci') && lower.includes('setrika'))) {
    let reply = `Halo Kak! Untuk paket *Cuci Komplit (Cuci + Setrika)* harganya *Rp 8.000 / Kg* 🧺👔.\n\n`;
    reply += `✨ Fasilitas yang didapat:\n`;
    reply += `• Cuci bersih higienis dengan detergen ramah serat kain\n`;
    reply += `• Pewangi dan pelembut premium tahan lama\n`;
    reply += `• Setrika uap halus dan rapi anti-lecek\n`;
    reply += `• Pengepakan plastik rapi & higienis\n\n`;
    reply += `Estimasi pengerjaan: 1 - 2 hari. Mau kami jadwalkan penjemputan sekarang? 🛵`;
    return { reply, order_code: null };
  }

  // Specific: Cuci Kering / Lipat
  if (lower.includes('kering') || lower.includes('lipat')) {
    let reply = `Halo Kak! Untuk paket *Cuci Kering (Lipat)* harganya *Rp 6.000 / Kg* 🧺✨.\n\n`;
    reply += `✨ Paket ini mencakup cuci bersih, pewangi, pengeringan mesin 100% kering, dan dilipat rapi tanpa setrika. Sangat cocok dan ekonomis untuk pakaian harian, kaos, dan handuk!\n\n`;
    reply += `Estimasi pengerjaan: 1 - 2 hari. Cukup hubungi kami untuk pickup! 🛵`;
    return { reply, order_code: null };
  }

  // Specific: Setrika Saja
  if (lower.includes('setrika') && !lower.includes('cuci')) {
    let reply = `Halo Kak! Untuk paket *Setrika Saja* harganya *Rp 5.000 / Kg* 👔✨.\n\n`;
    reply += `✨ Pakaian bersih Anda akan kami setrika menggunakan setrika uap profesional, disemprot parfum laundry tahan lama, dan dilipat rapi atau digantung.\n\n`;
    reply += `Estimasi pengerjaan: 1 hari kerja.`;
    return { reply, order_code: null };
  }

  // Specific: Express / Kilat / Cepat
  if (lower.includes('express') || lower.includes('kilat') || lower.includes('cepat') || lower.includes('3 jam')) {
    let reply = `Halo Kak! Kami menyediakan paket *Express 3 Jam* seharga *Rp 15.000 / Kg* ⚡🧺.\n\n`;
    reply += `⚡ Keunggulan Express 3 Jam:\n`;
    reply += `• Prioritas utama (langsung masuk 1 mesin khusus tanpa antri)\n`;
    reply += `• Cuci, kering, dan setrika uap kilat\n`;
    reply += `• Selesai dan siap pakai hanya dalam 3 jam!\n\n`;
    reply += `Sangat pas untuk Anda yang butuh pakaian darurat untuk meeting, wisuda, atau bepergian!`;
    return { reply, order_code: null };
  }

  // Specific: Bedcover / Selimut / Sprei
  if (lower.includes('bedcover') || lower.includes('selimut') || lower.includes('sprei') || lower.includes('sprey')) {
    let reply = `Halo Kak! Untuk cuci *Bedcover / Selimut* harganya *Rp 25.000 / Pcs* 🛏️✨.\n\n`;
    reply += `✨ Kami menggunakan mesin kapasitas besar khusus bedcover dengan detergen anti-bakteri dan tungau, sehingga selimut kembali mengembang tebal, wangi, dan nyaman untuk tidur.`;
    return { reply, order_code: null };
  }

  // Specific: Sepatu / Tas / Helm / Karpet
  if (lower.includes('sepatu') || lower.includes('tas') || lower.includes('helm') || lower.includes('karpet')) {
    let reply = `Halo Kak! Saat ini Rels Laundry mengkhususkan diri pada *Laundry Pakaian Kiloan, Bedcover, Selimut, dan Pakaian Formal/Satuan* 🧺.\n\n`;
    reply += `Untuk layanan cuci sepatu & tas premium akan segera kami hadirkan dalam waktu dekat ya kak! Terima kasih atas minatnya. 🙏`;
    return { reply, order_code: null };
  }

  // 4. Intent: General Price List & Services (e.g. harga, tarif, biaya, paket, kiloan)
  if (lower.includes('harga') || lower.includes('tarif') || lower.includes('paket') || lower.includes('biaya') || lower.includes('sekilo') || lower.includes('kiloan') || lower.includes('pricelist') || lower.includes('menu')) {
    let reply = `Halo Kak! Berikut daftar harga & paket layanan Rels Laundry 🧺✨:\n\n`;
    reply += `1. *Cuci Komplit (Cuci + Setrika)* : Rp 8.000 / Kg\n`;
    reply += `2. *Cuci Kering (Lipat)* : Rp 6.000 / Kg\n`;
    reply += `3. *Setrika Saja* : Rp 5.000 / Kg\n`;
    reply += `4. *Express 3 Jam* : Rp 15.000 / Kg (Selesai Cepat!)\n`;
    reply += `5. *Bedcover / Selimut* : Rp 25.000 / Pcs\n\n`;
    reply += `🛵 *Gratis Antar-Jemput* untuk cucian minimal 5 Kg!\n`;
    reply += `Untuk cek status order yang sedang dicuci, cukup ketik nomor nota Anda (contoh: *WASH-1001*) atau nama Anda.`;
    return { reply, order_code: null };
  }

  // 5. Intent: Location / Address
  if (lower.includes('alamat') || lower.includes('lokasi') || lower.includes('dimana') || lower.includes('tempat') || lower.includes('posisi') || lower.includes('outlet') || lower.includes('toko') || lower.includes('cabang')) {
    let reply = `Outlet *Rels Laundry* berlokasi di 📍:\n\n`;
    reply += `🏢 *Jl. Awan Digital No. 88, Cloud City*\n`;
    reply += `(Patokan: 50 meter di samping Kampus, persis di seberang Minimarket 24 Jam).\n\n`;
    reply += `Jika malas keluar rumah, Anda cukup santai dan gunakan layanan *Antar-Jemput Gratis* kami! Ketik *antar jemput* untuk memesan kurir ke rumah Anda. 🛵📦`;
    return { reply, order_code: null };
  }

  // 6. Intent: Operational Hours
  if (lower.includes('jam') || lower.includes('buka') || lower.includes('tutup') || lower.includes('operasional') || lower.includes('jadwal') || lower.includes('hari apa')) {
    let reply = `⏰ *Jam Operasional Rels Laundry*:\n\n`;
    reply += `• *Buka Setiap Hari* (Senin s/d Minggu): 07.00 - 21.00 WIB\n`;
    reply += `• *Kurir Antar-Jemput*: 08.00 - 20.00 WIB\n`;
    reply += `• Hari libur nasional & akhir pekan *tetap buka normal*!\n\n`;
    reply += `Cucian yang masuk sebelum jam 12.00 siang bisa diproses lebih cepat lho kak! 🧺✨`;
    return { reply, order_code: null };
  }

  // 7. Intent: Duration / How long
  if (lower.includes('lama') || lower.includes('kapan') || lower.includes('hari') || lower.includes('durasi') || lower.includes('waktu') || lower.includes('proses')) {
    let reply = `Estimasi waktu pengerjaan di Rels Laundry ⏱️:\n\n`;
    reply += `• *Layanan Reguler* (Cuci Komplit / Kering): 1 - 2 Hari Selesai\n`;
    reply += `• *Layanan Kilat*: 24 Jam Selesai\n`;
    reply += `• *Layanan Express*: 3 Jam Langsung Selesai!\n\n`;
    reply += `Begitu cucian Anda selesai disetrika dan dipacking, WhatsApp bot kami akan otomatis mengirimkan notifikasi ke nomor Anda! 📲`;
    return { reply, order_code: null };
  }

  // 8. Intent: Payment Methods
  if (lower.includes('bayar') || lower.includes('pembayaran') || lower.includes('qris') || lower.includes('transfer') || lower.includes('cash') || lower.includes('tunai') || lower.includes('rekening')) {
    let reply = `Metode pembayaran di Rels Laundry sangat praktis & fleksibel 💳💵:\n\n`;
    reply += `1. 📱 *QRIS* (Bisa discan melalui GoPay, OVO, Dana, ShopeePay, LinkAja, & semua aplikasi Mobile Banking)\n`;
    reply += `2. 💵 *Tunai / Cash* (Langsung di kasir outlet atau bayar ke kurir saat antar cucian)\n`;
    reply += `3. 🏧 *Transfer Bank* (BCA / Mandiri / BRI / BNI)\n\n`;
    reply += `Setiap transaksi resmi mendapatkan E-Receipt dengan QR Code verifikasi. ✨`;
    return { reply, order_code: null };
  }

  // 9. Intent: Antar-Jemput & Pickup Kurir
  if (lower.includes('antar') || lower.includes('jemput') || lower.includes('pickup') || lower.includes('kurir') || lower.includes('delivery') || lower.includes('ongkir') || lower.includes('ambil')) {
    let reply = `Layanan kurir antar-jemput Rels Laundry siap melayani setiap hari dari jam *08.00 - 20.00 WIB* 🛵📦.\n\n`;
    reply += `🎁 *GRATIS Ongkir* untuk cucian minimal 5 Kg! (di bawah 5 Kg hanya Rp 5.000 flat).\n\n`;
    reply += `Untuk jadwalkan penjemputan cucian ke rumah, silakan balas chat ini dengan rincian:\n`;
    reply += `• *Nama*: \n• *Alamat Lengkap*: \n• *Perkiraan Berat*: \n• *Jam Penjemputan*: \n\n`;
    reply += `Kurir kami akan langsung merapat ke lokasi Anda!`;
    return { reply, order_code: null };
  }

  // 10. Intent: Thank you / Closing
  if (lower.includes('makasih') || lower.includes('terima kasih') || lower.includes('thanks') || lower.includes('tengkyu') || lower === 'ok' || lower === 'oke' || lower === 'siap' || lower === 'mantap' || lower === 'sip') {
    let reply = `Sama-sama Kak! Senang bisa melayani Anda. 😊🧺\n\n`;
    reply += `Jika ada hal lain yang ingin ditanyakan atau ingin order cucian, jangan sungkan chat Rels Laundry kapan saja ya! Semoga hari Anda menyenangkan dan sehat selalu! ✨`;
    return { reply, order_code: null };
  }

  // 11. Intent: Greeting & Welcome
  if (lower.includes('halo') || lower.includes('hai') || lower.includes('assalam') || lower.includes('pagi') || lower.includes('siang') || lower.includes('sore') || lower.includes('malam') || lower.includes('permisi') || lower === 'p' || lower === 'tes' || lower === 'test') {
    let reply = `Halo! Selamat datang di Layanan Otomatis WhatsApp Rels Laundry 🧺✨\n\n`;
    reply += `⏰ *Jam Operasional*: Buka Setiap Hari (07.00 - 21.00 WIB)\n\n`;
    reply += `Apa yang bisa kami bantu hari ini? Anda bisa langsung tanyakan apa saja, contohnya:\n`;
    reply += `• Ketik kode nota (contoh: *WASH-1001*) atau ketik nama Anda untuk cek status cucian.\n`;
    reply += `• Ketik *harga* untuk melihat daftar paket komplit, kiloan, dan express.\n`;
    reply += `• Ketik *antar jemput* untuk memesan kurir jemput ke rumah Anda.\n`;
    reply += `• Ketik *lokasi* untuk info alamat outlet kami.`;
    return { reply, order_code: null };
  }

  // 12. Fallback Response (Conversational and helpful)
  let fallback = `Halo! Terima kasih telah menghubungi WhatsApp Rels Laundry 🧺✨\n\n`;
  fallback += `Terkait pertanyaan Anda: *"${cleanMsg}"*\n\n`;
  fallback += `Untuk kemudahan Anda, silakan ketik salah satu kata kunci berikut:\n`;
  fallback += `👉 Ketik nomor nota (contoh: *WASH-1001*) atau nama Anda untuk cek apakah cucian sudah selesai.\n`;
  fallback += `👉 Ketik *harga* untuk daftar tarif komplit, setrika, express, dan bedcover.\n`;
  fallback += `👉 Ketik *antar jemput* untuk pemesanan kurir ke alamat Anda.\n`;
  fallback += `👉 Ketik *alamat* atau *jam buka* untuk informasi outlet.\n\n`;
  fallback += `Admin Rels Laundry juga akan siap membantu menjawab pertanyaan Anda lebih lanjut. 🙏`;
  return { reply: fallback, order_code: null };
}

// GET /api/whatsapp/messages & GET /api/whatsapp/chats - Get recent WhatsApp conversations
router.get(['/messages', '/chats'], (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
    const chats = db.getChatLogs(limit);
    return res.json({ success: true, count: chats.length, data: chats });
  } catch (err) {
    logger.error('Failed to get WhatsApp chats', { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

// POST /api/whatsapp/chat - Customer sends a message -> Bot replies instantly!
router.post('/chat', (req, res) => {
  try {
    const { message, phone = '081234567890' } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'MESSAGE_REQUIRED',
        message: 'Pesan chat dari pelanggan tidak boleh kosong.',
      });
    }

    // 1. Record incoming customer message
    db.insertChat('CUSTOMER', phone, message.trim(), null);

    // 2. Generate smart bot reply based on intent & live database
    const { reply, order_code } = processCustomerInquiry(message, phone);

    // 3. Record bot reply
    db.insertChat('BOT', phone, reply, order_code);
    db.insertLog('INFO', 'WA_BOT', `Bot auto-replied to [${phone}]: "${message.trim().substring(0, 30)}..."`);

    return res.json({
      success: true,
      sender: 'BOT',
      phone,
      reply,
      order_code,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('WhatsApp bot failure', { error: err.message });
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

module.exports = router;
