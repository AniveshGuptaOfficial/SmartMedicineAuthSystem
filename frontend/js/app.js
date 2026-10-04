/**
 * Smart Medicine Authentication System - Frontend Application
 * Full-stack glassmorphism UI with role-based access
 */

const API_BASE = '/api';
let currentUser = null;
let authToken = localStorage.getItem('smartmed_token');

// ==================== AUTHENTICATION ====================

document.addEventListener('DOMContentLoaded', () => {
  setupAuthForms();
  if (authToken) {
    validateToken();
  }
});

function setupAuthForms() {
  // Toggle between login and register
  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
  });

  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
  });

  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    await login(email, password);
  });

  // Register form
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
      role: document.getElementById('reg-role').value,
      phone: document.getElementById('reg-phone').value,
      address: document.getElementById('reg-address').value
    };
    await register(data);
  });
}

async function login(email, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('smartmed_token', authToken);
      showApp();
      showToast('Welcome back, ' + data.user.name + '!', 'success');
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  }
}

async function register(userData) {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (res.ok) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('smartmed_token', authToken);
      showApp();
      showToast('Account created successfully!', 'success');
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  }
}

async function validateToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      currentUser = await res.json();
      showApp();
    } else {
      logout();
    }
  } catch {
    logout();
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('smartmed_token');
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
}

// ==================== APP NAVIGATION ====================

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('user-name').textContent = currentUser.name;

  setupNavigation();
  showSection('dashboard');
  loadDashboard();
  loadNotifications();
}

function setupNavigation() {
  const navLinks = document.getElementById('nav-links');
  const role = currentUser.role;

  let links = [
    { id: 'dashboard', label: 'Dashboard', roles: ['customer', 'pharmacy', 'manufacturer', 'admin'] },
    { id: 'medicines', label: 'Medicines', roles: ['customer', 'pharmacy', 'admin'] },
    { id: 'orders', label: 'Orders', roles: ['customer', 'pharmacy', 'admin'] },
    { id: 'qr', label: 'QR Verify', roles: ['customer', 'pharmacy', 'admin'] },
    { id: 'manufacturer', label: 'Manufacturer', roles: ['manufacturer'] },
    { id: 'pharmacy', label: 'Pharmacy', roles: ['pharmacy'] },
    { id: 'admin', label: 'Admin', roles: ['admin'] }
  ];

  navLinks.innerHTML = links
    .filter(l => l.roles.includes(role))
    .map(l => `<li><button class="nav-link" onclick="showSection('${l.id}')">${l.label}</button></li>`)
    .join('');
}

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${sectionId}`).classList.add('active');

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  event.target.classList.add('active');

  // Load section data
  switch(sectionId) {
    case 'dashboard': loadDashboard(); break;
    case 'medicines': loadMedicines(); break;
    case 'orders': loadOrders(); break;
    case 'qr': loadVerificationHistory(); break;
    case 'admin': loadAdminPanel(); break;
    case 'manufacturer': loadManufacturerPanel(); break;
    case 'pharmacy': loadPharmacyPanel(); break;
  }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
  const container = document.getElementById('dashboard-content');
  const role = currentUser.role;

  if (role === 'customer') {
    container.innerHTML = '<p class="text-muted">Loading dashboard...</p>';
    try {
      const [medRes, orderRes] = await Promise.all([
        fetch(`${API_BASE}/medicines`, { headers: authHeaders() }),
        fetch(`${API_BASE}/orders/my-orders`, { headers: authHeaders() })
      ]);
      const medicines = await medRes.json();
      const orders = await orderRes.json();

      container.innerHTML = `
        <div class="stats-grid">
          <div class="glass-card stat-card">
            <div class="stat-icon">💊</div>
            <div class="stat-value">${medicines.length}</div>
            <div class="stat-label">Available Medicines</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">📦</div>
            <div class="stat-value">${orders.length}</div>
            <div class="stat-label">Total Orders</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${orders.filter(o => o.status === 'delivered').length}</div>
            <div class="stat-label">Delivered</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">🔍</div>
            <div class="stat-value">${orders.filter(o => ['pending','confirmed','processing','dispatched','in_transit'].includes(o.status)).length}</div>
            <div class="stat-label">In Progress</div>
          </div>
        </div>
        <h2 class="section-subtitle">Recent Orders</h2>
        <div class="orders-list">
          ${orders.slice(0, 5).map(order => renderOrderCard(order, 'customer')).join('') || '<p class="text-muted">No orders yet. Browse medicines to place your first order!</p>'}
        </div>
      `;
    } catch (err) {
      container.innerHTML = '<p class="text-muted">Failed to load dashboard.</p>';
    }
  } else if (role === 'pharmacy') {
    container.innerHTML = '<p class="text-muted">Loading...</p>';
    try {
      const orderRes = await fetch(`${API_BASE}/orders/pharmacy-orders`, { headers: authHeaders() });
      const orders = await orderRes.json();

      container.innerHTML = `
        <div class="stats-grid">
          <div class="glass-card stat-card">
            <div class="stat-icon">📦</div>
            <div class="stat-value">${orders.length}</div>
            <div class="stat-label">Total Orders</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">⏳</div>
            <div class="stat-value">${orders.filter(o => o.status === 'pending').length}</div>
            <div class="stat-label">Pending</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">🚚</div>
            <div class="stat-value">${orders.filter(o => ['dispatched','in_transit'].includes(o.status)).length}</div>
            <div class="stat-label">In Transit</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${orders.filter(o => o.status === 'delivered').length}</div>
            <div class="stat-label">Delivered</div>
          </div>
        </div>
        <h2 class="section-subtitle">Recent Orders</h2>
        <div class="orders-list">
          ${orders.slice(0, 5).map(order => renderOrderCard(order, 'pharmacy')).join('') || '<p class="text-muted">No orders received yet.</p>'}
        </div>
      `;
    } catch (err) {
      container.innerHTML = '<p class="text-muted">Failed to load dashboard.</p>';
    }
  } else if (role === 'manufacturer') {
    container.innerHTML = '<p class="text-muted">Loading...</p>';
    try {
      const medRes = await fetch(`${API_BASE}/medicines/manufacturer/my-medicines`, { headers: authHeaders() });
      const medicines = await medRes.json();

      container.innerHTML = `
        <div class="stats-grid">
          <div class="glass-card stat-card">
            <div class="stat-icon">💊</div>
            <div class="stat-value">${medicines.length}</div>
            <div class="stat-label">My Medicines</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">📦</div>
            <div class="stat-value">${medicines.reduce((a, m) => a + (m.batch_count || 0), 0)}</div>
            <div class="stat-label">Total Batches</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-value">${medicines.reduce((a, m) => a + (m.total_stock || 0), 0)}</div>
            <div class="stat-label">Total Stock</div>
          </div>
        </div>
        <h2 class="section-subtitle">My Medicines</h2>
        <div class="medicines-grid">
          ${medicines.slice(0, 6).map(m => renderMedicineCard(m, 'manufacturer')).join('') || '<p class="text-muted">No medicines registered yet.</p>'}
        </div>
      `;
    } catch (err) {
      container.innerHTML = '<p class="text-muted">Failed to load dashboard.</p>';
    }
  } else if (role === 'admin') {
    container.innerHTML = '<p class="text-muted">Loading admin dashboard...</p>';
    try {
      const statsRes = await fetch(`${API_BASE}/admin/stats`, { headers: authHeaders() });
      const stats = await statsRes.json();

      container.innerHTML = `
        <div class="stats-grid">
          <div class="glass-card stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-value">${stats.users.total}</div>
            <div class="stat-label">Total Users</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">💊</div>
            <div class="stat-value">${stats.medicines.total}</div>
            <div class="stat-label">Medicines</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">📦</div>
            <div class="stat-value">${stats.orders.total}</div>
            <div class="stat-label">Orders</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-value">₹${stats.orders.revenue.toFixed(0)}</div>
            <div class="stat-label">Revenue</div>
          </div>
        </div>
        <div class="stats-grid">
          <div class="glass-card stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${stats.verifications.authentic}</div>
            <div class="stat-label">Authentic Scans</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">⚠️</div>
            <div class="stat-value">${stats.verifications.fake}</div>
            <div class="stat-label">Fake Detected</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">⏰</div>
            <div class="stat-value">${stats.verifications.expired}</div>
            <div class="stat-label">Expired Found</div>
          </div>
          <div class="glass-card stat-card">
            <div class="stat-icon">🔄</div>
            <div class="stat-value">${stats.verifications.duplicate}</div>
            <div class="stat-label">Duplicates</div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = '<p class="text-muted">Failed to load admin dashboard.</p>';
    }
  }
}

// ==================== MEDICINES ====================

async function loadMedicines() {
  const grid = document.getElementById('medicines-grid');
  grid.innerHTML = '<p class="text-muted">Loading medicines...</p>';

  try {
    const res = await fetch(`${API_BASE}/medicines`, { headers: authHeaders() });
    const medicines = await res.json();

    // Load categories
    const catRes = await fetch(`${API_BASE}/medicines/categories`, { headers: authHeaders() });
    const categories = await catRes.json();
    const catSelect = document.getElementById('category-filter');
    catSelect.innerHTML = '<option value="">All Categories</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');

    grid.innerHTML = medicines.map(m => renderMedicineCard(m, currentUser.role)).join('') || '<p class="text-muted">No medicines found.</p>';
  } catch (err) {
    grid.innerHTML = '<p class="text-muted">Failed to load medicines.</p>';
  }
}

function renderMedicineCard(med, role) {
  const batches = med.batches || [];
  const totalStock = batches.reduce((a, b) => a + b.quantity, 0);
  const lowestPrice = batches.length > 0 ? Math.min(...batches.map(b => b.price)) : med.price;

  return `
    <div class="glass-card medicine-card">
      <div class="medicine-name">${med.name}</div>
      <span class="medicine-category">${med.category}</span>
      <p class="medicine-desc">${med.description || 'No description available.'}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="medicine-price">₹${lowestPrice.toFixed(2)}</span>
        <span class="medicine-stock">${totalStock > 0 ? totalStock + ' in stock' : 'Out of stock'}</span>
      </div>
      ${role === 'customer' && totalStock > 0 ? `
        <div class="medicine-actions">
          <button class="btn btn-primary btn-small" onclick="showOrderModal('${med.id}', '${med.name}', ${lowestPrice})">Order Now</button>
        </div>
      ` : ''}
    </div>
  `;
}

// ==================== ORDERS ====================

async function loadOrders() {
  const container = document.getElementById('orders-content');
  container.innerHTML = '<p class="text-muted">Loading orders...</p>';

  try {
    let url = `${API_BASE}/orders/my-orders`;
    if (currentUser.role === 'pharmacy') url = `${API_BASE}/orders/pharmacy-orders`;
    if (currentUser.role === 'admin') url = `${API_BASE}/admin/orders`;

    const res = await fetch(url, { headers: authHeaders() });
    const orders = await res.json();

    container.innerHTML = `<div class="orders-list">${orders.map(o => renderOrderCard(o, currentUser.role)).join('') || '<p class="text-muted">No orders found.</p>'}</div>`;
  } catch (err) {
    container.innerHTML = '<p class="text-muted">Failed to load orders.</p>';
  }
}

function renderOrderCard(order, role) {
  const statusClass = `status-${order.status}`;
  const canCancel = role === 'customer' && ['pending', 'confirmed'].includes(order.status);
  const canUpdate = role === 'pharmacy' && ['pending', 'confirmed', 'processing', 'dispatched'].includes(order.status);

  const nextStatus = {
    pending: 'confirmed',
    confirmed: 'processing',
    processing: 'dispatched',
    dispatched: 'in_transit'
  };

  return `
    <div class="glass-card order-card">
      <div class="order-header">
        <span class="order-id">#${order.uuid.substring(0, 8)}</span>
        <span class="order-status ${statusClass}">${order.status.replace('_', ' ')}</span>
      </div>
      <div class="order-items">
        ${(order.items || []).map(item => `
          <div class="order-item">
            <span>${item.medicine_name} (Batch: ${item.batch_number})</span>
            <span>${item.quantity} x ₹${item.price.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <div class="order-footer">
        <span class="order-total">Total: ₹${order.total_amount.toFixed(2)}</span>
        <div style="display:flex;gap:0.5rem;">
          ${canCancel ? `<button class="btn btn-danger btn-small" onclick="cancelOrder(${order.id})">Cancel</button>` : ''}
          ${canUpdate && nextStatus[order.status] ? `<button class="btn btn-primary btn-small" onclick="updateOrderStatus(${order.id}, '${nextStatus[order.status]}')">Mark as ${nextStatus[order.status].replace('_', ' ')}</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

async function cancelOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order?')) return;
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Order cancelled successfully', 'success');
      loadOrders();
    } else {
      showToast(data.error || 'Failed to cancel order', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Order marked as ${status.replace('_', ' ')}`, 'success');
      loadOrders();
    } else {
      showToast(data.error || 'Failed to update status', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

// ==================== QR VERIFICATION ====================

async function verifyQR() {
  const qrInput = document.getElementById('qr-input');
  const qrCode = qrInput.value.trim();
  if (!qrCode) {
    showToast('Please enter a QR code', 'warning');
    return;
  }

  const resultDiv = document.getElementById('qr-result');
  resultDiv.className = 'glass-card qr-result';
  resultDiv.innerHTML = '<p>Verifying...</p>';
  resultDiv.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/qr/verify`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_code: qrCode, location: 'Web Portal' })
    });
    const data = await res.json();

    const statusConfig = {
      authentic: { icon: '✅', title: 'AUTHENTIC', color: 'var(--success)' },
      fake: { icon: '🚨', title: 'COUNTERFEIT DETECTED', color: 'var(--danger)' },
      duplicate: { icon: '⚠️', title: 'SUSPICIOUS DUPLICATE', color: 'var(--warning)' },
      expired: { icon: '⏰', title: 'EXPIRED', color: 'var(--warning)' },
      not_found: { icon: '❌', title: 'NOT FOUND', color: 'var(--danger)' }
    };

    const config = statusConfig[data.status] || statusConfig.not_found;

    resultDiv.classList.add(data.status);
    resultDiv.innerHTML = `
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="font-size:3rem;">${config.icon}</div>
        <h2 style="color:${config.color};margin-top:0.5rem;">${config.title}</h2>
        <p style="color:var(--text-secondary);">${data.message}</p>
      </div>
      ${data.medicine ? `
        <div style="background:rgba(255,255,255,0.04);border-radius:var(--radius-sm);padding:1rem;margin-bottom:1rem;">
          <h4>${data.medicine.name}</h4>
          <p style="color:var(--text-secondary);font-size:0.9rem;">
            Batch: ${data.medicine.batch_number} | Mfg: ${data.medicine.manufacturing_date} | Exp: ${data.medicine.expiry_date}
          </p>
          <p style="color:var(--text-muted);font-size:0.85rem;">Manufacturer: ${data.medicine.manufacturer}</p>
        </div>
      ` : ''}
      ${data.dosage ? `
        <div style="background:rgba(16,185,129,0.08);border-radius:var(--radius-sm);padding:1rem;margin-bottom:1rem;">
          <h4 style="color:var(--success);">Dosage Information</h4>
          <p><strong>Dosage:</strong> ${data.dosage.info}</p>
          <p><strong>Instructions:</strong> ${data.dosage.instructions}</p>
          <p style="color:var(--warning);"><strong>Warnings:</strong> ${data.dosage.warnings}</p>
        </div>
      ` : ''}
      ${data.blockchain ? `
        <div style="background:rgba(99,102,241,0.08);border-radius:var(--radius-sm);padding:1rem;">
          <h4 style="color:var(--accent-primary);">Blockchain Verification</h4>
          <p style="font-size:0.85rem;color:var(--text-secondary);">
            Status: ${data.blockchain.valid ? '✅ Chain Valid' : '❌ Chain Invalid'} | 
            Records: ${data.blockchain.records}
          </p>
          <p style="font-size:0.75rem;color:var(--text-muted);font-family:monospace;word-break:break-all;">
            Hash: ${data.blockchain.hash}
          </p>
        </div>
      ` : ''}
    `;

    loadVerificationHistory();
  } catch (err) {
    resultDiv.innerHTML = '<p style="color:var(--danger);">Verification failed. Please try again.</p>';
  }
}

async function loadVerificationHistory() {
  const container = document.getElementById('verification-history');
  try {
    const res = await fetch(`${API_BASE}/qr/history`, { headers: authHeaders() });
    const history = await res.json();

    container.innerHTML = history.map(h => `
      <div class="glass-card verification-item">
        <div>
          <strong>${h.medicine_name || 'Unknown'}</strong>
          <span style="color:var(--text-muted);font-size:0.85rem;margin-left:0.5rem;">${h.batch_number || 'N/A'}</span>
        </div>
        <div style="display:flex;align-items:center;gap:1rem;">
          <span class="verif-status" style="color:${getStatusColor(h.verification_status)}">${h.verification_status.toUpperCase()}</span>
          <span style="color:var(--text-muted);font-size:0.8rem;">${new Date(h.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('') || '<p class="text-muted">No verification history yet.</p>';
  } catch (err) {
    container.innerHTML = '<p class="text-muted">Failed to load history.</p>';
  }
}

function getStatusColor(status) {
  const colors = { authentic: 'var(--success)', fake: 'var(--danger)', duplicate: 'var(--warning)', expired: 'var(--warning)', not_found: 'var(--danger)' };
  return colors[status] || 'var(--text-secondary)';
}

// ==================== ADMIN PANEL ====================

async function loadAdminPanel() {
  showAdminTab('users');
}

function showAdminTab(tab) {
  document.querySelectorAll('#section-admin .tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  const container = document.getElementById('admin-content');

  if (tab === 'users') {
    container.innerHTML = '<p class="text-muted">Loading users...</p>';
    fetch(`${API_BASE}/admin/users`, { headers: authHeaders() })
      .then(r => r.json())
      .then(users => {
        container.innerHTML = `
          <div class="glass-card" style="overflow-x:auto;">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td>${u.name}</td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-info">${u.role}</span></td>
                    <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>${new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      ${u.role !== 'admin' ? `
                        <button class="btn btn-small ${u.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleUserStatus('${u.uuid}', ${!u.is_active})">
                          ${u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      ` : '-'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      });
  } else if (tab === 'stats') {
    container.innerHTML = '<p class="text-muted">Loading stats...</p>';
    fetch(`${API_BASE}/admin/stats`, { headers: authHeaders() })
      .then(r => r.json())
      .then(stats => {
        container.innerHTML = `
          <div class="stats-grid">
            <div class="glass-card stat-card"><div class="stat-icon">👥</div><div class="stat-value">${stats.users.total}</div><div class="stat-label">Total Users</div></div>
            <div class="glass-card stat-card"><div class="stat-icon">🏥</div><div class="stat-value">${stats.users.pharmacies}</div><div class="stat-label">Pharmacies</div></div>
            <div class="glass-card stat-card"><div class="stat-icon">🏭</div><div class="stat-value">${stats.users.manufacturers}</div><div class="stat-label">Manufacturers</div></div>
            <div class="glass-card stat-card"><div class="stat-icon">💊</div><div class="stat-value">${stats.medicines.total}</div><div class="stat-label">Medicines</div></div>
            <div class="glass-card stat-card"><div class="stat-icon">📦</div><div class="stat-value">${stats.orders.total}</div><div class="stat-label">Orders</div></div>
            <div class="glass-card stat-card"><div class="stat-icon">💰</div><div class="stat-value">₹${stats.orders.revenue.toFixed(0)}</div><div class="stat-label">Revenue</div></div>
            <div class="glass-card stat-card"><div class="stat-icon">✅</div><div class="stat-value">${stats.verifications.authentic}</div><div class="stat-label">Authentic</div></div>
            <div class="glass-card stat-card"><div class="stat-icon">🚨</div><div class="stat-value">${stats.verifications.fake}</div><div class="stat-label">Fake Detected</div></div>
          </div>
        `;
      });
  } else if (tab === 'orders') {
    container.innerHTML = '<p class="text-muted">Loading orders...</p>';
    fetch(`${API_BASE}/admin/orders`, { headers: authHeaders() })
      .then(r => r.json())
      .then(orders => {
        container.innerHTML = `
          <div class="glass-card" style="overflow-x:auto;">
            <table class="data-table">
              <thead><tr><th>Order ID</th><th>Customer</th><th>Pharmacy</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                ${orders.map(o => `
                  <tr>
                    <td style="font-family:monospace;">#${o.uuid.substring(0, 8)}</td>
                    <td>${o.customer_name}</td>
                    <td>${o.pharmacy_name}</td>
                    <td>₹${o.total_amount.toFixed(2)}</td>
                    <td><span class="order-status status-${o.status}">${o.status.replace('_', ' ')}</span></td>
                    <td>${new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      });
  } else if (tab === 'analytics') {
    container.innerHTML = '<p class="text-muted">Loading analytics...</p>';
    fetch(`${API_BASE}/admin/analytics/verifications`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        const statusCounts = {};
        data.byStatus.forEach(s => { statusCounts[s.verification_status] = s.count; });

        container.innerHTML = `
          <div class="stats-grid">
            <div class="glass-card stat-card"><div class="stat-icon">✅</div><div class="stat-value" style="color:var(--success);">${statusCounts.authentic || 0}</div><div class="stat-label">Authentic</div></div>
            <div class="glass-card stat-card"><div class="stat-icon">🚨</div><div class="stat-value" style="color:var(--danger);">${statusCounts.fake || 0}</div><div class="stat-label">Fake</div></div>
            <div class="glass-card stat-card"><div class="stat-icon">⚠️</div><div class="stat-value" style="color:var(--warning);">${statusCounts.duplicate || 0}</div><div class="stat-label">Duplicate</div></div>
            <div class="glass-card stat-card"><div class="stat-icon">⏰</div><div class="stat-value" style="color:var(--warning);">${statusCounts.expired || 0}</div><div class="stat-label">Expired</div></div>
          </div>
          <h2 class="section-subtitle">Daily Verification Trend</h2>
          <div class="glass-card" style="padding:1.5rem;">
            ${data.byDate.length > 0 ? data.byDate.map(d => `
              <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <span>${d.date}</span>
                <span style="color:${getStatusColor(d.verification_status)};">${d.verification_status}: ${d.count}</span>
              </div>
            `).join('') : '<p class="text-muted">No data available</p>'}
          </div>
        `;
      });
  }
}

async function toggleUserStatus(uuid, isActive) {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${uuid}/status`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive })
    });
    if (res.ok) {
      showToast(`User ${isActive ? 'activated' : 'deactivated'}`, 'success');
      showAdminTab('users');
    } else {
      const data = await res.json();
      showToast(data.error || 'Failed to update user', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

// ==================== MANUFACTURER PANEL ====================

function loadManufacturerPanel() {
  showMfrTab('medicines');
}

function showMfrTab(tab) {
  document.querySelectorAll('#section-manufacturer .tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  const container = document.getElementById('manufacturer-content');

  if (tab === 'medicines') {
    container.innerHTML = '<p class="text-muted">Loading...</p>';
    fetch(`${API_BASE}/medicines/manufacturer/my-medicines`, { headers: authHeaders() })
      .then(r => r.json())
      .then(medicines => {
        container.innerHTML = medicines.length === 0
          ? '<p class="text-muted">No medicines registered yet. Add your first medicine!</p>'
          : `<div class="medicines-grid">${medicines.map(m => `
            <div class="glass-card medicine-card">
              <div class="medicine-name">${m.name}</div>
              <span class="medicine-category">${m.category}</span>
              <p class="medicine-desc">${m.description || 'No description'}</p>
              <div style="display:flex;justify-content:space-between;">
                <span class="medicine-price">₹${m.price.toFixed(2)}</span>
                <span class="medicine-stock">${m.batch_count} batches | ${m.total_stock} units</span>
              </div>
            </div>
          `).join('')}</div>`;
      });
  } else if (tab === 'add-medicine') {
    container.innerHTML = `
      <div class="glass-card" style="max-width:600px;">
        <h2 style="margin-bottom:1.5rem;">Register New Medicine</h2>
        <form id="add-medicine-form">
          <div class="form-group"><label>Medicine Name</label><input type="text" id="med-name" required placeholder="e.g., Paracetamol 500mg"></div>
          <div class="form-group"><label>Category</label>
            <select id="med-category" required>
              <option value="">Select category</option>
              <option>Pain Relief</option><option>Anti-Inflammatory</option><option>Antibiotic</option>
              <option>Antihistamine</option><option>Antacid</option><option>Supplement</option>
              <option>Cough & Cold</option><option>Hydration</option><option>Other</option>
            </select>
          </div>
          <div class="form-group"><label>Description</label><textarea id="med-desc" rows="2" placeholder="Brief description"></textarea></div>
          <div class="form-group"><label>Price (₹)</label><input type="number" id="med-price" step="0.01" min="0" required placeholder="0.00"></div>
          <div class="form-group"><label>Dosage Info</label><input type="text" id="med-dosage" placeholder="e.g., 1-2 tablets every 4-6 hours"></div>
          <div class="form-group"><label>Usage Instructions</label><input type="text" id="med-usage" placeholder="e.g., Take with water after food"></div>
          <div class="form-group"><label>Safety Warnings</label><input type="text" id="med-warnings" placeholder="e.g., Do not exceed recommended dose"></div>
          <button type="submit" class="btn btn-primary btn-full">Register Medicine</button>
        </form>
      </div>
    `;

    document.getElementById('add-medicine-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById('med-name').value,
        category: document.getElementById('med-category').value,
        description: document.getElementById('med-desc').value,
        price: parseFloat(document.getElementById('med-price').value),
        dosage_info: document.getElementById('med-dosage').value,
        usage_instructions: document.getElementById('med-usage').value,
        safety_warnings: document.getElementById('med-warnings').value
      };
      try {
        const res = await fetch(`${API_BASE}/medicines`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
          showToast('Medicine registered successfully!', 'success');
          showMfrTab('medicines');
        } else {
          showToast(result.error || 'Failed to register medicine', 'error');
        }
      } catch (err) {
        showToast('Network error', 'error');
      }
    });
  } else if (tab === 'add-batch') {
    container.innerHTML = '<p class="text-muted">Loading medicines...</p>';
    fetch(`${API_BASE}/medicines/manufacturer/my-medicines`, { headers: authHeaders() })
      .then(r => r.json())
      .then(medicines => {
        container.innerHTML = `
          <div class="glass-card" style="max-width:600px;">
            <h2 style="margin-bottom:1.5rem;">Create Medicine Batch</h2>
            <form id="add-batch-form">
              <div class="form-group"><label>Select Medicine</label>
                <select id="batch-medicine" required>
                  <option value="">Select medicine</option>
                  ${medicines.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group"><label>Batch Number</label><input type="text" id="batch-number" required placeholder="e.g., BAT-2024-001"></div>
              <div class="form-group"><label>Manufacturing Date</label><input type="date" id="batch-mfg" required></div>
              <div class="form-group"><label>Expiry Date</label><input type="date" id="batch-exp" required></div>
              <div class="form-group"><label>Quantity</label><input type="number" id="batch-qty" min="1" required placeholder="100"></div>
              <button type="submit" class="btn btn-primary btn-full">Create Batch & Generate QR</button>
            </form>
            <div id="batch-result" style="margin-top:1.5rem;"></div>
          </div>
        `;

        document.getElementById('add-batch-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const medicineId = document.getElementById('batch-medicine').value;
          const data = {
            batch_number: document.getElementById('batch-number').value,
            manufacturing_date: document.getElementById('batch-mfg').value,
            expiry_date: document.getElementById('batch-exp').value,
            quantity: parseInt(document.getElementById('batch-qty').value)
          };
          try {
            const res = await fetch(`${API_BASE}/medicines/${medicineId}/batches`, {
              method: 'POST',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            const result = await res.json();
            if (res.ok) {
              showToast('Batch created successfully!', 'success');
              document.getElementById('batch-result').innerHTML = `
                <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:var(--radius-sm);padding:1rem;">
                  <h4 style="color:var(--success);">✅ Batch Created</h4>
                  <p><strong>Batch:</strong> ${result.batch.batch_number}</p>
                  <p><strong>QR Code:</strong> ${result.batch.qr_code}</p>
                  <p><strong>Blockchain Hash:</strong> <span style="font-family:monospace;font-size:0.75rem;word-break:break-all;">${result.batch.blockchain_hash}</span></p>
                  <div style="text-align:center;margin-top:1rem;">
                    <img src="${result.batch.qr_code_image}" alt="QR Code" style="max-width:200px;border-radius:var(--radius-sm);">
                  </div>
                </div>
              `;
            } else {
              showToast(result.error || 'Failed to create batch', 'error');
            }
          } catch (err) {
            showToast('Network error', 'error');
          }
        });
      });
  }
}

// ==================== PHARMACY PANEL ====================

function loadPharmacyPanel() {
  showPharmacyTab('orders');
}

function showPharmacyTab(tab) {
  document.querySelectorAll('#section-pharmacy .tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  const container = document.getElementById('pharmacy-content');

  if (tab === 'orders') {
    container.innerHTML = '<p class="text-muted">Loading orders...</p>';
    fetch(`${API_BASE}/orders/pharmacy-orders`, { headers: authHeaders() })
      .then(r => r.json())
      .then(orders => {
        container.innerHTML = orders.length === 0
          ? '<p class="text-muted">No orders received yet.</p>'
          : `<div class="orders-list">${orders.map(o => renderOrderCard(o, 'pharmacy')).join('')}</div>`;
      });
  } else if (tab === 'verify') {
    container.innerHTML = `
      <div class="glass-card" style="max-width:600px;">
        <h2 style="margin-bottom:1.5rem;">Verify Medicine Before Dispensing</h2>
        <p style="color:var(--text-secondary);margin-bottom:1.5rem;">Scan or enter the QR code to verify medicine authenticity before dispensing to customers.</p>
        <div class="form-group">
          <input type="text" id="pharmacy-qr-input" placeholder="Enter QR code" style="width:100%;padding:0.875rem 1rem;background:rgba(255,255,255,0.06);border:1px solid var(--glass-border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:1rem;">
        </div>
        <button class="btn btn-primary" onclick="pharmacyVerify()">Verify Medicine</button>
        <div id="pharmacy-verify-result" style="margin-top:1.5rem;"></div>
      </div>
    `;
  }
}

async function pharmacyVerify() {
  const qrCode = document.getElementById('pharmacy-qr-input').value.trim();
  if (!qrCode) { showToast('Please enter a QR code', 'warning'); return; }

  const resultDiv = document.getElementById('pharmacy-verify-result');
  resultDiv.innerHTML = '<p>Verifying...</p>';

  try {
    const res = await fetch(`${API_BASE}/qr/verify`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_code: qrCode, location: 'Pharmacy Portal' })
    });
    const data = await res.json();

    const canDispense = data.status === 'authentic';
    resultDiv.innerHTML = `
      <div class="glass-card qr-result ${data.status}" style="padding:1.5rem;">
        <h3 style="color:${getStatusColor(data.status)};">${data.status.toUpperCase()}</h3>
        <p>${data.message}</p>
        ${data.medicine ? `<p><strong>${data.medicine.name}</strong> | Batch: ${data.medicine.batch_number}</p>` : ''}
        <div style="margin-top:1rem;">
          <button class="btn ${canDispense ? 'btn-success' : 'btn-danger'}" ${!canDispense ? 'disabled' : ''} style="opacity:${canDispense ? 1 : 0.5};">
            ${canDispense ? '✅ Safe to Dispense' : '❌ DO NOT DISPENSE'}
          </button>
        </div>
      </div>
    `;
  } catch (err) {
    resultDiv.innerHTML = '<p style="color:var(--danger);">Verification failed.</p>';
  }
}

// ==================== NOTIFICATIONS ====================

async function loadNotifications() {
  try {
    const res = await fetch(`${API_BASE}/admin/notifications`, { headers: authHeaders() });
    const notifications = await res.json();
    const unread = notifications.filter(n => !n.is_read).length;
    const badge = document.getElementById('notif-badge');
    if (unread > 0) {
      badge.textContent = unread;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (err) { /* silent fail */ }
}

function showNotifications() {
  const modal = document.getElementById('notifications-modal');
  const list = document.getElementById('notifications-list');

  fetch(`${API_BASE}/admin/notifications`, { headers: authHeaders() })
    .then(r => r.json())
    .then(notifications => {
      list.innerHTML = notifications.length === 0
        ? '<p class="text-muted">No notifications</p>'
        : notifications.map(n => `
          <div class="notification-item ${n.type}">
            <div class="notif-title">${n.title}</div>
            <div class="notif-msg">${n.message}</div>
            <div class="notif-time">${new Date(n.created_at).toLocaleString()}</div>
          </div>
        `).join('');
      modal.classList.remove('hidden');
    });
}

function closeNotifications() {
  document.getElementById('notifications-modal').classList.add('hidden');
  loadNotifications();
}

// ==================== UTILITY ====================

function authHeaders() {
  return { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 4000);
}

function showOrderModal(medicineId, medicineName, price) {
  const qty = prompt(`Enter quantity for ${medicineName} (₹${price.toFixed(2)} each):`, '1');
  if (!qty || parseInt(qty) <= 0) return;

  // For simplicity, using default pharmacy
  fetch(`${API_BASE}/auth/profile`, { headers: authHeaders() })
    .then(r => r.json())
    .then(() => {
      // Get default pharmacy
      fetch(`${API_BASE}/admin/users?role=pharmacy`, { headers: authHeaders() })
        .then(r => r.json())
        .then(users => {
          if (users.length === 0) {
            showToast('No pharmacy available', 'error');
            return;
          }
          placeOrder(medicineId, parseInt(qty), users[0].uuid);
        });
    });
}

async function placeOrder(batchId, quantity, pharmacyId) {
  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ batch_id: batchId, quantity }], pharmacy_id: pharmacyId })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Order placed successfully!', 'success');
      loadDashboard();
    } else {
      showToast(data.error || 'Failed to place order', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}
