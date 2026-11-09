// ===============================================================
// WashFlow LMS - Modern Laundry Management System with QR Code
// Client-side Application Controller
// ===============================================================

const state = {
  orders: [],
  logs: [],
  chats: [],
  stats: null,
  health: null,
  currentTab: 'overview',
  activeServiceFilter: 'ALL',
  editingOrderId: null,
  deletingOrderId: null,
  garmentCounts: {
    tshirt: 0,
    shirt: 0,
    jeans: 0,
    jacket: 0,
    bedsheet: 0,
  },
  garmentWeights: {
    tshirt: 0.20,
    shirt: 0.25,
    jeans: 0.60,
    jacket: 0.70,
    bedsheet: 1.50,
  },
  pricingRates: {
    'Cuci Komplit (Cuci + Setrika)': 8000,
    'Cuci Kering (Lipat)': 6000,
    'Setrika Saja': 5000,
    'Express 3 Jam': 15000,
    'Bedcover / Selimut': 25000,
  },
};

// Gender Silhouette Avatar Generator (Polosan tanpa foto)
function getCustomerAvatarHtml(name) {
  const cleanName = (name || '').trim();
  const lower = cleanName.toLowerCase();
  
  // Deteksi nama/panggilan perempuan
  const isFemale = /(ibu|dewi|rina|sri|rahayu|lestari|wulandari|putri|siti|ayu|mama|mbak|nyonya|nona|wati|dini|maya|sarah)/i.test(lower);
  
  if (isFemale) {
    return `
      <div class="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 text-rose-500 flex items-center justify-center text-xs shrink-0 shadow-xs" title="${cleanName} (Perempuan)">
        <i class="fa-solid fa-user text-[11px]"></i>
      </div>
    `;
  } else {
    return `
      <div class="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xs shrink-0 shadow-xs" title="${cleanName} (Laki-laki)">
        <i class="fa-solid fa-user text-[11px]"></i>
      </div>
    `;
  }
}

// Helper: Format Rupiah Currency
function formatRupiah(amount) {
  const num = Number(amount) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

// Helper: Format Date String
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return dateStr;
  }
}

// ==========================================
// API Interaction Utilities
// ==========================================
async function apiRequest(endpoint, options = {}) {
  try {
    const res = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const contentType = res.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  } catch (err) {
    console.error(`API Request to ${endpoint} failed:`, err);
    return {
      ok: false,
      status: 0,
      data: { error: 'NETWORK_ERROR', message: err.message },
    };
  }
}

// ==========================================
// Toast Notification
// ==========================================
function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-600 text-white',
    info: 'bg-blue-600 text-white',
  };

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-triangle-exclamation',
    warning: 'fa-circle-exclamation',
    info: 'fa-circle-info',
  };

  toast.className = `${typeStyles[type] || typeStyles.info} pointer-events-auto flex items-start space-x-2.5 p-3.5 rounded-xl shadow-lg text-xs max-w-sm transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} text-base mt-0.5 shrink-0"></i>
    <div class="flex-1">
      ${title ? `<p class="font-bold text-xs">${title}</p>` : ''}
      <p class="leading-relaxed">${message}</p>
    </div>
    <button class="text-white/80 hover:text-white shrink-0 ml-1" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// ==========================================
// Tab Switching Navigation
// ==========================================
function switchTab(tabId) {
  state.currentTab = tabId;

  // Update nav buttons
  document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update panels
  document.querySelectorAll('.view-panel').forEach((panel) => {
    if (panel.id === `view-${tabId}`) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });

  if (tabId === 'chat') {
    loadChatMessages();
    setTimeout(() => {
      const c = document.getElementById('wa-chat-container');
      if (c) c.scrollTop = c.scrollHeight;
    }, 100);
  } else if (tabId === 'logs') {
    fetchLogs();
  }
}

// ==========================================
// Interactive Garment Counter
// ==========================================
function adjustGarment(type, delta) {
  if (!state.garmentCounts.hasOwnProperty(type)) return;

  const current = state.garmentCounts[type];
  const updated = Math.max(0, current + delta);
  state.garmentCounts[type] = updated;

  const qtyEl = document.getElementById(`garment-${type}-qty`);
  if (qtyEl) qtyEl.textContent = updated;

  // Calculate estimated total weight
  let totalEstWeight = 0;
  for (const [key, count] of Object.entries(state.garmentCounts)) {
    totalEstWeight += count * state.garmentWeights[key];
  }

  // Update weight input if > 0
  const weightInput = document.getElementById('quick-weight');
  if (weightInput) {
    if (totalEstWeight > 0) {
      weightInput.value = totalEstWeight.toFixed(1);
    }
    recalculateQuickTotal();
  }
}

function resetGarments() {
  for (const key of Object.keys(state.garmentCounts)) {
    state.garmentCounts[key] = 0;
    const qtyEl = document.getElementById(`garment-${key}-qty`);
    if (qtyEl) qtyEl.textContent = '0';
  }
  recalculateQuickTotal();
}

// Recalculate price in quick POS form
function recalculateQuickTotal() {
  const serviceSelect = document.getElementById('quick-service');
  const weightInput = document.getElementById('quick-weight');
  const priceDisplay = document.getElementById('quick-total-price');
  const rateLabel = document.getElementById('quick-rate-label');

  if (!serviceSelect || !weightInput || !priceDisplay) return;

  const service = serviceSelect.value;
  const rate = state.pricingRates[service] || 8000;
  const weight = parseFloat(weightInput.value) || 0;
  const total = Math.round(rate * weight);

  if (rateLabel) {
    const isPcs = service.includes('Bedcover');
    rateLabel.textContent = `${service} @ ${formatRupiah(rate)} / ${isPcs ? 'Pcs' : 'Kg'}`;
  }

  priceDisplay.textContent = formatRupiah(total);
}

// ==========================================
// Orders Rendering & Filters
// ==========================================
function filterByServiceCategory(category) {
  state.activeServiceFilter = category;

  document.querySelectorAll('.service-pill').forEach((pill) => {
    if (pill.getAttribute('data-service-filter') === category) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  renderOrdersTable();
}

function getStatusBadgeHtml(status) {
  const map = {
    'Antrian': { class: 'badge-antrian', icon: 'fa-clock' },
    'Proses Cuci': { class: 'badge-cuci', icon: 'fa-soap' },
    'Setrika': { class: 'badge-setrika', icon: 'fa-wand-magic-sparkles' },
    'Selesai': { class: 'badge-selesai', icon: 'fa-circle-check' },
    'Diambil / Diantar': { class: 'badge-diambil', icon: 'fa-truck-fast' },
  };

  const item = map[status] || { class: 'badge-antrian', icon: 'fa-circle' };
  return `<span class="badge-status ${item.class}"><i class="fa-solid ${item.icon}"></i> ${status}</span>`;
}

function renderOrdersTable() {
  const tbody = document.getElementById('orders-table-tbody');
  const countTag = document.getElementById('table-count-tag');
  const searchInput = document.getElementById('order-search-input');
  const statusFilter = document.getElementById('status-filter-select');

  if (!tbody) return;

  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const selectedStatus = statusFilter ? statusFilter.value : 'ALL';

  let filtered = state.orders;

  // Filter category
  if (state.activeServiceFilter !== 'ALL') {
    filtered = filtered.filter((o) => o.service_type === state.activeServiceFilter);
  }

  // Filter status
  if (selectedStatus !== 'ALL') {
    filtered = filtered.filter((o) => o.status === selectedStatus);
  }

  // Search keyword
  if (searchQuery) {
    filtered = filtered.filter(
      (o) =>
        (o.order_code && o.order_code.toLowerCase().includes(searchQuery)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(searchQuery)) ||
        (o.customer_phone && o.customer_phone.toLowerCase().includes(searchQuery))
    );
  }

  if (countTag) {
    countTag.textContent = `${filtered.length} Order`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-400">
          <div class="flex flex-col items-center justify-center space-y-1">
            <i class="fa-solid fa-box-open text-2xl text-slate-300 mb-1"></i>
            <p class="font-medium text-slate-500">Tidak ada order yang sesuai kriteria.</p>
            <p class="text-[11px] text-slate-400">Coba ubah kata kunci pencarian atau buat order baru.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((order, idx) => {
      const trackingUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${order.order_code}`;

      return `
        <tr class="hover:bg-blue-50/40 transition border-b border-slate-100">
          <!-- Nota & QR Thumbnail -->
          <td class="py-3 px-3">
            <div class="flex items-center space-x-2">
              <button onclick="openReceiptModalByCode('${order.order_code}')" title="Klik untuk Cetak E-Receipt & QR"
                class="w-8 h-8 rounded-lg bg-white border border-slate-200 p-0.5 hover:border-blue-500 hover:shadow-xs transition shrink-0 group">
                <img src="${trackingUrl}" alt="QR" class="w-full h-full object-contain group-hover:scale-105 transition">
              </button>
              <div>
                <span class="font-mono-code font-bold text-blue-700 block text-xs cursor-pointer hover:underline" onclick="openReceiptModalByCode('${order.order_code}')">
                  ${order.order_code}
                </span>
                <span class="text-[10px] text-slate-400">${formatDate(order.created_at).split(',')[0]}</span>
              </div>
            </div>
          </td>

          <!-- Customer (Gender Silhouette Icon) -->
          <td class="py-3 px-3">
            <div class="flex items-center space-x-2.5">
              ${getCustomerAvatarHtml(order.customer_name)}
              <div>
                <p class="font-bold text-slate-800 leading-tight">${order.customer_name}</p>
                <a href="https://wa.me/${order.customer_phone.replace(/\D/g, '')}" target="_blank" class="text-[11px] text-slate-500 hover:text-emerald-600 flex items-center">
                  <i class="fa-brands fa-whatsapp text-emerald-500 mr-1 text-[10px]"></i> ${order.customer_phone}
                </a>
              </div>
            </div>
          </td>

          <!-- Service & Weight -->
          <td class="py-3 px-3">
            <p class="font-medium text-slate-800">${order.service_type}</p>
            <span class="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              ${order.weight_kg} Kg
            </span>
          </td>

          <!-- Total Price -->
          <td class="py-3 px-3 font-bold text-slate-900">
            ${formatRupiah(order.total_price)}
          </td>

          <!-- Status Dropdown Select -->
          <td class="py-3 px-3">
            <select onchange="updateOrderStatus(${order.id}, this.value)" 
              class="text-xs font-semibold rounded-lg border border-slate-200 px-2 py-1 bg-white focus:outline-none focus:border-blue-500 transition cursor-pointer">
              <option value="Antrian" ${order.status === 'Antrian' ? 'selected' : ''}>⏳ Antrian</option>
              <option value="Proses Cuci" ${order.status === 'Proses Cuci' ? 'selected' : ''}>🧼 Proses Cuci</option>
              <option value="Setrika" ${order.status === 'Setrika' ? 'selected' : ''}>♨️ Setrika</option>
              <option value="Selesai" ${order.status === 'Selesai' ? 'selected' : ''}>✅ Selesai</option>
              <option value="Diambil / Diantar" ${order.status === 'Diambil / Diantar' ? 'selected' : ''}>🛵 Diambil / Diantar</option>
            </select>
          </td>

          <!-- Actions -->
          <td class="py-3 px-3 text-right">
            <div class="flex items-center justify-end space-x-1">
              <button onclick="openReceiptModalByCode('${order.order_code}')" title="Buka E-Receipt QR"
                class="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition text-xs">
                <i class="fa-solid fa-receipt"></i>
              </button>
              <button onclick="openEditModal(${order.id})" title="Edit Order"
                class="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition text-xs">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button onclick="confirmDeleteOrder(${order.id}, '${order.order_code}')" title="Hapus Order"
                class="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition text-xs">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

// ==========================================
// Load Data & Healthcheck
// ==========================================
async function fetchOrders() {
  const res = await apiRequest('/api/orders');
  if (res.ok && res.data.success) {
    state.orders = res.data.data;
    state.stats = res.data.stats;
    if (res.data.pricingRates) {
      state.pricingRates = res.data.pricingRates;
    }
    updateDashboardStats();
    renderOrdersTable();
  }
}

function updateDashboardStats() {
  const statRevenue = document.getElementById('stat-revenue');
  const statWeight = document.getElementById('stat-weight');
  const statChats = document.getElementById('stat-chats');
  const orderCountBadge = document.getElementById('order-count-badge');

  const orders = Array.isArray(state.orders) ? state.orders : [];

  // 1. OMSET HARI INI: Otomatis masuk dari order yang sudah dibayar/lunas (Selesai atau Diambil / Diantar)
  const paidOrders = orders.filter((o) => o.status === 'Selesai' || o.status === 'Diambil / Diantar');
  const calculatedPaidRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
  const paidRevenue = state.stats?.paid_revenue ?? state.stats?.paidRevenue ?? calculatedPaidRevenue;
  if (statRevenue) {
    statRevenue.textContent = formatRupiah(paidRevenue);
  }

  // 2. TOTAL TIMBANGAN: Akumulasi seluruh berat cucian (Kg) yang masuk
  const calculatedTotalWeight = orders.reduce((sum, o) => sum + (Number(o.weight_kg) || 0), 0);
  const totalWeight = state.stats?.total_weight_kg ?? state.stats?.totalKg ?? (Math.round(calculatedTotalWeight * 10) / 10);
  if (statWeight) {
    statWeight.textContent = `${totalWeight} Kg`;
  }

  // 3. ORDER BERJALAN: Pesanan aktif yang sedang diproses (Antrian, Proses Cuci, Setrika)
  const activeOrders = orders.filter((o) => ['Antrian', 'Proses Cuci', 'Setrika'].includes(o.status)).length;
  const activeCount = state.stats?.active_orders ?? state.stats?.activeOrders ?? activeOrders;
  if (orderCountBadge) {
    orderCountBadge.textContent = `${activeCount} Order`;
  }

  // 4. NOTIFIKASI WA: Bertambah setiap kali ada interaksi chat dan notifikasi WhatsApp
  const chatCount = Math.max(state.chats.length, state.stats?.total_chats ?? state.stats?.totalChats ?? 0);
  if (statChats) {
    statChats.textContent = `${chatCount} Notifikasi`;
  }
}

async function checkHealth() {
  const res = await apiRequest('/health');
  const badge = document.getElementById('header-health-badge');
  const text = document.getElementById('header-health-text');

  if (res.ok && res.data.status === 'OK') {
    if (badge) {
      badge.className = 'hidden sm:flex items-center space-x-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-700';
    }
    if (text) text.textContent = 'Cloud 200 OK';
  } else {
    if (badge) {
      badge.className = 'hidden sm:flex items-center space-x-2 px-3 py-1 bg-rose-50 border border-rose-200 rounded-full text-xs font-semibold text-rose-700';
    }
    if (text) text.textContent = `Degraded (${res.status || '503'})`;
  }
}

// ==========================================
// E-RECEIPT & QR CODE MODAL
// ==========================================
function openReceiptModal(order) {
  if (!order) return;

  const modal = document.getElementById('receipt-modal');
  if (!modal) return;

  const barcodeEl = document.getElementById('receipt-barcode-number');
  const qrImg = document.getElementById('receipt-qr-image');
  const codeEl = document.getElementById('receipt-order-code');
  const custName = document.getElementById('receipt-customer-name');
  const custPhone = document.getElementById('receipt-customer-phone');
  const dateEl = document.getElementById('receipt-date-created');
  const pickupEl = document.getElementById('receipt-pickup-delivery');
  const statusBadge = document.getElementById('receipt-status-badge');
  const serviceTitle = document.getElementById('receipt-service-title');
  const serviceRate = document.getElementById('receipt-service-rate');
  const serviceSubtotal = document.getElementById('receipt-service-subtotal');
  const totalPrice = document.getElementById('receipt-total-price');
  const btnWaShare = document.getElementById('btn-receipt-wa-share');

  const originUrl = window.location.origin;
  const qrTarget = `${originUrl}/?track=${order.order_code}`;

  if (barcodeEl) barcodeEl.textContent = `TRX-${order.order_code}`;
  if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrTarget)}`;
  if (codeEl) codeEl.textContent = order.order_code;
  if (custName) custName.textContent = order.customer_name;
  if (custPhone) custPhone.textContent = order.customer_phone;
  if (dateEl) dateEl.textContent = formatDate(order.created_at);
  if (pickupEl) pickupEl.textContent = `${order.pickup_delivery || 'Ambil Sendiri'} (${order.delivery_time || 'Jadwal Reguler'})`;
  if (statusBadge) statusBadge.innerHTML = getStatusBadgeHtml(order.status);

  if (serviceTitle) serviceTitle.textContent = `${order.service_type} (${order.weight_kg} Kg)`;
  if (serviceRate) serviceRate.textContent = `${formatRupiah(order.price_per_kg || 8000)} / Kg`;
  if (serviceSubtotal) serviceSubtotal.textContent = formatRupiah(order.total_price);
  if (totalPrice) totalPrice.textContent = formatRupiah(order.total_price);

  if (btnWaShare) {
    const waText = encodeURIComponent(
      `Halo Kak *${order.customer_name}*! 👋\nBerikut E-Receipt Laundry Rels Laundry Anda:\n` +
      `🧾 *Nota*: ${order.order_code}\n` +
      `🧺 *Paket*: ${order.service_type} (${order.weight_kg} Kg)\n` +
      `💰 *Total*: ${formatRupiah(order.total_price)}\n` +
      `📌 *Status*: ${order.status}\n\n` +
      `Lacak status pengerjaan via scan QR Code atau kunjungi:\n${qrTarget}\n\nTerima kasih!`
    );
    btnWaShare.onclick = () => {
      window.open(`https://wa.me/${order.customer_phone.replace(/\D/g, '')}?text=${waText}`, '_blank');
    };
  }

  modal.classList.remove('hidden');
}

function openReceiptModalByCode(orderCode) {
  const order = state.orders.find((o) => o.order_code === orderCode);
  if (order) {
    openReceiptModal(order);
  } else {
    showToast(`Order ${orderCode} tidak ditemukan`, 'warning');
  }
}

function closeReceiptModal() {
  const modal = document.getElementById('receipt-modal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================
// QR CODE TRACKING VIEW SIMULATOR
// ==========================================
function simulateTrack(orderCode) {
  const input = document.getElementById('track-order-input');
  if (input) input.value = orderCode;
  trackOrderByCode(orderCode);
}

function trackOrderByCode(code) {
  if (!code) return;
  const cleanCode = code.trim().toUpperCase();
  const order = state.orders.find((o) => o.order_code.toUpperCase() === cleanCode);

  const qrImg = document.getElementById('track-qr-img');
  const codeLabel = document.getElementById('track-code-label');
  const custName = document.getElementById('track-cust-name');
  const custPhone = document.getElementById('track-cust-phone');
  const statusBadge = document.getElementById('track-status-badge');
  const totalPrice = document.getElementById('track-total-price');
  const btnReceipt = document.getElementById('btn-track-view-receipt');

  if (!order) {
    showToast(`Nota ${cleanCode} tidak ditemukan di database.`, 'error', 'Pencarian Gagal');
    return;
  }

  if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${order.order_code}`;
  if (codeLabel) codeLabel.textContent = order.order_code;
  if (custName) custName.textContent = order.customer_name;
  if (custPhone) custPhone.textContent = `WA: ${order.customer_phone}`;
  if (statusBadge) statusBadge.innerHTML = getStatusBadgeHtml(order.status);
  if (totalPrice) totalPrice.textContent = formatRupiah(order.total_price);

  if (btnReceipt) {
    btnReceipt.onclick = () => openReceiptModal(order);
  }

  showToast(`Berhasil memuat status nota ${order.order_code}`, 'success', 'QR Verified');
}

// ==========================================
// Order Status Update
// ==========================================
async function updateOrderStatus(orderId, newStatus) {
  const res = await apiRequest(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus }),
  });

  if (res.ok && res.data.success) {
    showToast(`Status berhasil diubah menjadi: ${newStatus}`, 'success', 'Status Diperbarui');
    await fetchOrders();
  } else {
    showToast(res.data?.message || 'Gagal mengubah status', 'error', 'Gagal');
    await fetchOrders();
  }
}

// ==========================================
// Order Modal (Create / Edit)
// ==========================================
function openCreateModal() {
  state.editingOrderId = null;
  const modal = document.getElementById('order-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('order-form');
  const err = document.getElementById('modal-form-error');
  const statusGroup = document.getElementById('form-status-group');
  const pickupGroup = document.getElementById('form-pickup-group');
  const submitText = document.getElementById('form-submit-text');

  if (title) title.textContent = 'Tambah Order Laundry Baru';
  if (submitText) submitText.textContent = 'Buat Order & Cetak Nota QR';
  if (form) form.reset();
  const idEl = document.getElementById('form-order-id');
  if (idEl) idEl.value = '';
  const statusEl = document.getElementById('form-status');
  if (statusEl) statusEl.value = 'Antrian';

  // Hide status field for customer/staff order intake; auto-default to Antrian
  if (statusGroup) statusGroup.classList.add('hidden');
  if (pickupGroup) {
    pickupGroup.classList.remove('col-span-1');
    pickupGroup.classList.add('col-span-2');
  }

  if (err) err.classList.add('hidden');
  modal.classList.remove('hidden');
}

function openEditModal(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  state.editingOrderId = orderId;
  const modal = document.getElementById('order-modal');
  const title = document.getElementById('modal-title');
  const err = document.getElementById('modal-form-error');
  const statusGroup = document.getElementById('form-status-group');
  const pickupGroup = document.getElementById('form-pickup-group');
  const submitText = document.getElementById('form-submit-text');

  if (title) title.textContent = `Edit Data & Status Order (#${order.order_code})`;
  if (submitText) submitText.textContent = 'Simpan Perubahan';
  if (err) err.classList.add('hidden');

  // Show status field for admin status management
  if (statusGroup) statusGroup.classList.remove('hidden');
  if (pickupGroup) {
    pickupGroup.classList.remove('col-span-2');
    pickupGroup.classList.add('col-span-1');
  }

  document.getElementById('form-order-id').value = order.id;
  document.getElementById('form-name').value = order.customer_name;
  document.getElementById('form-phone').value = order.customer_phone;
  document.getElementById('form-service').value = order.service_type;
  document.getElementById('form-weight').value = order.weight_kg;
  document.getElementById('form-status').value = order.status;
  document.getElementById('form-pickup').value = order.pickup_delivery || 'Ambil Sendiri';
  document.getElementById('form-notes').value = order.notes || '';

  modal.classList.remove('hidden');
}

function closeOrderModal() {
  const modal = document.getElementById('order-modal');
  if (modal) modal.classList.add('hidden');
}

function confirmDeleteOrder(orderId, orderCode) {
  state.deletingOrderId = orderId;
  const modal = document.getElementById('delete-modal');
  const codeEl = document.getElementById('delete-order-code');
  if (codeEl) codeEl.textContent = orderCode;
  if (modal) modal.classList.remove('hidden');
}

function closeDeleteModal() {
  state.deletingOrderId = null;
  const modal = document.getElementById('delete-modal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================
// WhatsApp Bot Chat Simulator
// ==========================================
async function loadChatMessages() {
  const res = await apiRequest('/api/whatsapp/chats');
  if (res.ok && res.data.success) {
    state.chats = res.data.data;
    renderChatMessages();
    updateDashboardStats();
  }
}

function renderChatMessages() {
  const container = document.getElementById('wa-chat-container');
  if (!container) return;

  if (state.chats.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-slate-400">
        <i class="fa-brands fa-whatsapp text-3xl text-emerald-500 mb-2"></i>
        <p class="text-xs">Belum ada riwayat percakapan. Mulai kirim pesan!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.chats
    .map((chat) => {
      const isBot = chat.sender === 'BOT';
      const bubbleClass = isBot ? 'wa-bubble-bot mr-auto' : 'wa-bubble-customer ml-auto';
      const alignClass = isBot ? 'justify-start' : 'justify-end';

      return `
        <div class="flex ${alignClass} mb-2">
          <div class="${bubbleClass} max-w-[85%] p-3 text-xs text-slate-800 space-y-1">
            <div class="flex items-center justify-between space-x-2 text-[10px] text-slate-500 pb-1 border-b border-black/5">
              <span class="font-bold ${isBot ? 'text-emerald-700' : 'text-blue-700'}">
                ${isBot ? '🤖 Rels Laundry Bot' : '👤 Pelanggan (' + (chat.phone || 'Anda') + ')'}
              </span>
              <span>${formatDate(chat.timestamp).split(',')[1] || ''}</span>
            </div>
            <p class="leading-relaxed whitespace-pre-line">${chat.message}</p>
          </div>
        </div>
      `;
    })
    .join('');

  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage(message) {
  if (!message || !message.trim()) return;

  const phone = '081398765432';
  const container = document.getElementById('wa-chat-container');

  // Optimistic UI for user message
  const userMsgHtml = `
    <div class="flex justify-end mb-2">
      <div class="wa-bubble-customer ml-auto max-w-[85%] p-3 text-xs text-slate-800 space-y-1">
        <div class="flex items-center justify-between space-x-2 text-[10px] text-slate-500 pb-1 border-b border-black/5">
          <span class="font-bold text-blue-700">👤 Anda</span>
          <span>Baru saja</span>
        </div>
        <p class="leading-relaxed whitespace-pre-line">${message}</p>
      </div>
    </div>
  `;
  if (container) {
    container.insertAdjacentHTML('beforeend', userMsgHtml);
    container.scrollTop = container.scrollHeight;
  }

  // Temporary bot typing indicator
  const typingIndicatorId = `typing-${Date.now()}`;
  const typingHtml = `
    <div id="${typingIndicatorId}" class="flex justify-start mb-2">
      <div class="wa-bubble-bot mr-auto max-w-[85%] p-2.5 text-xs text-slate-500 italic flex items-center space-x-2">
        <i class="fa-solid fa-circle-notch fa-spin text-emerald-600"></i>
        <span>🤖 Rels Laundry Bot sedang mengetik...</span>
      </div>
    </div>
  `;
  if (container) {
    container.insertAdjacentHTML('beforeend', typingHtml);
    container.scrollTop = container.scrollHeight;
  }

  const res = await apiRequest('/api/whatsapp/chat', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      message,
    }),
  });

  const typingEl = document.getElementById(typingIndicatorId);
  if (typingEl) typingEl.remove();

  if (res.ok && res.data.success) {
    // If bot returned reply directly, append immediately to avoid delay
    if (res.data.reply && container) {
      const botMsgHtml = `
        <div class="flex justify-start mb-2">
          <div class="wa-bubble-bot mr-auto max-w-[85%] p-3 text-xs text-slate-800 space-y-1">
            <div class="flex items-center justify-between space-x-2 text-[10px] text-slate-500 pb-1 border-b border-black/5">
              <span class="font-bold text-emerald-700">🤖 Rels Laundry Bot</span>
              <span>Baru saja</span>
            </div>
            <p class="leading-relaxed whitespace-pre-line">${res.data.reply}</p>
          </div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', botMsgHtml);
      container.scrollTop = container.scrollHeight;
    }
    await loadChatMessages();
    await fetchOrders();
  } else {
    showToast(res.data?.message || 'Gagal mengirim pesan bot', 'error');
  }
}

function sendQuickChatMessage(prompt) {
  const input = document.getElementById('wa-input-message');
  if (input) input.value = prompt;
  sendChatMessage(prompt);
}

// ==========================================
// Audit Logs
// ==========================================
async function fetchLogs() {
  const container = document.getElementById('terminal-log-container');
  if (!container) return;

  container.innerHTML = '<p class="text-slate-400">// Mengambil system audit logs...</p>';

  const res = await apiRequest('/api/logs');
  if (res.ok && res.data.success) {
    state.logs = res.data.data;
    if (state.logs.length === 0) {
      container.innerHTML = '<p class="text-slate-500">// Tidak ada log tercatat.</p>';
      return;
    }

    container.innerHTML = state.logs
      .map((log) => {
        let levelColor = 'text-blue-400';
        if (log.level === 'WARN') levelColor = 'text-amber-400';
        if (log.level === 'ERROR') levelColor = 'text-rose-400';

        return `
          <div class="flex items-start space-x-2">
            <span class="text-slate-500">[${formatDate(log.timestamp)}]</span>
            <span class="${levelColor} font-bold">[${log.level}]</span>
            <span class="text-indigo-300">[${log.source}]</span>
            <span class="text-slate-200">${log.message}</span>
          </div>
        `;
      })
      .join('');
  } else {
    container.innerHTML = '<p class="text-rose-400">// Gagal mengambil log.</p>';
  }
}

// ==========================================
// DevOps Lab & University Grading Test Triggers
// ==========================================
function setupDevOpsLab() {
  const btnNegative = document.getElementById('btn-demo-negative-validation');
  const btnDisruptFail = document.getElementById('btn-toggle-disrupt-fail');
  const btnDisruptRecover = document.getElementById('btn-toggle-disrupt-recover');
  const outputCode = document.getElementById('demo-output-code');
  const outputStatus = document.getElementById('demo-output-status-code');

  if (btnNegative) {
    btnNegative.addEventListener('click', async () => {
      outputStatus.textContent = 'TESTING...';
      outputStatus.className = 'text-[11px] font-mono-code font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded';

      const invalidPayload = {
        customer_name: '',
        customer_phone: 'nomor-ngasal-123',
        service_type: 'Paket-Ga-Ada',
        weight_kg: -4.5,
      };

      const res = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify(invalidPayload),
      });

      outputStatus.textContent = `HTTP ${res.status} BAD REQUEST`;
      outputStatus.className = 'text-[11px] font-mono-code font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded';
      outputCode.textContent = JSON.stringify(
        {
          test_name: 'Negative Input Validation (HTTP 400)',
          sent_payload: invalidPayload,
          response_status: res.status,
          response_body: res.data,
        },
        null,
        2
      );

      showToast(
        'Negative test berhasil! Server merespons 400 Bad Request dengan validation message terstruktur.',
        'success',
        'Validasi Sukses'
      );
    });
  }

  if (btnDisruptFail) {
    btnDisruptFail.addEventListener('click', async () => {
      outputStatus.textContent = 'INJECTING FAULT...';
      const res = await apiRequest('/health/disrupt', {
        method: 'POST',
        body: JSON.stringify({ fail: true }),
      });

      outputStatus.textContent = 'DATABASE DISRUPTED (503)';
      outputStatus.className = 'text-[11px] font-mono-code font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded';
      outputCode.textContent = JSON.stringify(
        {
          test_name: 'Fault Injection: Sever Database Storage',
          server_response: res.data,
          expected_behavior: 'Next healthcheck and DB queries will return HTTP 503 Service Unavailable',
        },
        null,
        2
      );

      showToast('Simulasi gangguan aktif! Healthcheck kini 503.', 'warning', 'Fault Injected');
      checkHealth();
    });
  }

  if (btnDisruptRecover) {
    btnDisruptRecover.addEventListener('click', async () => {
      outputStatus.textContent = 'RECOVERING SERVICE...';
      const res = await apiRequest('/health/disrupt', {
        method: 'POST',
        body: JSON.stringify({ fail: false }),
      });

      outputStatus.textContent = 'SYSTEM NORMAL (200 OK)';
      outputStatus.className = 'text-[11px] font-mono-code font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded';
      outputCode.textContent = JSON.stringify(
        {
          test_name: 'Fault Recovery: Restore Database Connection',
          server_response: res.data,
          current_health: 'Healthy 200 OK',
        },
        null,
        2
      );

      showToast('Layanan berhasil dipulihkan normal! Healthcheck 200 OK.', 'success', 'System Recovered');
      checkHealth();
      fetchOrders();
    });
  }
}

// ==========================================
// Form Event Listeners & Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Check URL query parameters for ?track=WASH-XXXX
  const urlParams = new URLSearchParams(window.location.search);
  const trackParam = urlParams.get('track');

  // Quick POS Form calculation events
  const quickService = document.getElementById('quick-service');
  const quickWeight = document.getElementById('quick-weight');
  if (quickService) quickService.addEventListener('change', recalculateQuickTotal);
  if (quickWeight) quickWeight.addEventListener('input', recalculateQuickTotal);

  const btnResetGarments = document.getElementById('btn-reset-garments');
  if (btnResetGarments) btnResetGarments.addEventListener('click', resetGarments);

  // Quick POS Form Submission
  const quickPosForm = document.getElementById('quick-pos-form');
  if (quickPosForm) {
    quickPosForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('quick-name').value;
      const phone = document.getElementById('quick-phone').value;
      const service = document.getElementById('quick-service').value;
      const weight = document.getElementById('quick-weight').value;
      const pickup = document.getElementById('quick-pickup').value;
      const notes = document.getElementById('quick-notes').value;

      const payload = {
        customer_name: name,
        customer_phone: phone,
        service_type: service,
        weight_kg: Number(weight),
        pickup_delivery: pickup,
        notes: notes,
      };

      const btnSubmit = document.getElementById('btn-submit-quick');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Membuat QR Code...';
      }

      const res = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-qrcode mr-2"></i> Simpan Order & Buat QR Code Nota';
      }

      if (res.ok && res.data.success) {
        showToast(
          `Order ${res.data.data.order_code} berhasil dibuat!`,
          'success',
          'Order Sukses'
        );

        // Reset form & garment counter
        quickPosForm.reset();
        resetGarments();
        recalculateQuickTotal();

        // Refresh orders & open E-receipt modal immediately!
        await fetchOrders();
        openReceiptModal(res.data.data);
      } else {
        const errMsg = res.data.message || (res.data.errors && res.data.errors[0]?.message) || 'Gagal membuat order';
        showToast(errMsg, 'error', 'Validasi Gagal');
      }
    });
  }

  // Search and Filter Listeners
  const searchInput = document.getElementById('order-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderOrdersTable());
  }

  const statusFilterSelect = document.getElementById('status-filter-select');
  if (statusFilterSelect) {
    statusFilterSelect.addEventListener('change', () => renderOrdersTable());
  }

  // QR Tracker Button & Input
  const btnSearchTrack = document.getElementById('btn-search-track');
  const trackOrderInput = document.getElementById('track-order-input');
  if (btnSearchTrack) {
    btnSearchTrack.addEventListener('click', () => {
      if (trackOrderInput) trackOrderByCode(trackOrderInput.value);
    });
  }
  if (trackOrderInput) {
    trackOrderInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') trackOrderByCode(trackOrderInput.value);
    });
  }

  // WhatsApp Form
  const waChatForm = document.getElementById('wa-chat-form');
  const waInputMessage = document.getElementById('wa-input-message');
  if (waChatForm) {
    waChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (waInputMessage && waInputMessage.value.trim()) {
        sendChatMessage(waInputMessage.value.trim());
        waInputMessage.value = '';
      }
    });
  }

  // Modal Buttons
  const btnOpenCreate = document.getElementById('btn-open-create-modal');
  if (btnOpenCreate) btnOpenCreate.addEventListener('click', openCreateModal);

  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeOrderModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeOrderModal);

  // Edit Form Submit
  const orderForm = document.getElementById('order-form');
  if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderId = document.getElementById('form-order-id').value;
      const isCreate = !orderId || orderId.trim() === '';

      const payload = {
        customer_name: document.getElementById('form-name').value.trim(),
        customer_phone: document.getElementById('form-phone').value.trim(),
        service_type: document.getElementById('form-service').value,
        weight_kg: Number(document.getElementById('form-weight').value),
        pickup_delivery: document.getElementById('form-pickup').value,
        notes: document.getElementById('form-notes').value.trim(),
      };

      if (!isCreate) {
        payload.status = document.getElementById('form-status').value;
      } else {
        payload.status = 'Antrian';
      }

      const endpoint = isCreate ? '/api/orders' : `/api/orders/${orderId}`;
      const method = isCreate ? 'POST' : 'PUT';

      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.ok && res.data.success) {
        showToast(
          isCreate ? `Order baru [#${res.data.data?.order_code || ''}] berhasil dibuat!` : 'Data & status order berhasil diperbarui',
          'success',
          isCreate ? 'Nota Baru Tersimpan' : 'Status Diperbarui'
        );
        closeOrderModal();
        await fetchOrders();

        if (isCreate && res.data.data) {
          // Immediately display and allow printing of the QR e-receipt for customer
          openReceiptModal(res.data.data);
        }
      } else {
        const errEl = document.getElementById('modal-form-error');
        if (errEl) {
          errEl.textContent = res.data.message || 'Gagal menyimpan perubahan order';
          errEl.classList.remove('hidden');
        }
      }
    });
  }

  // Delete Confirm Button
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteModal);
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
      if (!state.deletingOrderId) return;
      const res = await apiRequest(`/api/orders/${state.deletingOrderId}`, {
        method: 'DELETE',
      });
      if (res.ok && res.data.success) {
        showToast('Order berhasil dihapus dari database', 'success');
        closeDeleteModal();
        await fetchOrders();
      } else {
        showToast(res.data.message || 'Gagal menghapus order', 'error');
      }
    });
  }

  // Logs Refresh
  const btnRefreshLogs = document.getElementById('btn-refresh-logs');
  if (btnRefreshLogs) btnRefreshLogs.addEventListener('click', fetchLogs);

  // Setup DevOps Lab
  setupDevOpsLab();

  // Initial Load
  recalculateQuickTotal();
  fetchOrders();
  loadChatMessages();
  checkHealth();

  // If URL has ?track=WASH-XXXX, switch to track tab immediately!
  if (trackParam) {
    switchTab('track');
    simulateTrack(trackParam);
  }

  // Listen for Escape key to close all modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeReceiptModal();
      closeOrderModal();
      closeDeleteModal();
    }
  });

  // Polling health & orders periodically
  setInterval(checkHealth, 15000);
});
