/* ═══════════════════════════════════════════════════════════════════════════
   CYNEA.AI — Frontend Application
   ═══════════════════════════════════════════════════════════════════════════ */

const API = '';
let token = localStorage.getItem('cynea_token');
let currentUser = JSON.parse(localStorage.getItem('cynea_user') || 'null');
let partnerData = null;
let clientData = null;
let allModules = [];
let _tokenRefreshTimer = null;

// ── API Helper ──────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });

  // Handle 401 - attempt token refresh
  if (res.status === 401 && token && !options._isRetry) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${token}`;
      const retry = await fetch(`${API}${path}`, { ...options, headers, _isRetry: true });
      const retryData = await retry.json();
      if (!retry.ok) throw new Error(retryData.error || 'Request failed');
      return retryData;
    } else {
      showSessionExpired();
      throw new Error('Session expired');
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Toast Notification System ───────────────────────────────────────────

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span><button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toast-slide-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Session Management ──────────────────────────────────────────────────

function getTokenExpiry() {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000;
  } catch { return null; }
}

function startTokenRefreshTimer() {
  if (_tokenRefreshTimer) clearTimeout(_tokenRefreshTimer);
  const expiry = getTokenExpiry();
  if (!expiry) return;
  const refreshIn = expiry - Date.now() - 5 * 60 * 1000; // 5 min before expiry
  if (refreshIn > 0) {
    _tokenRefreshTimer = setTimeout(async () => {
      await attemptTokenRefresh();
    }, refreshIn);
  }
}

async function attemptTokenRefresh() {
  try {
    const res = await fetch(`${API}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('cynea_token', token);
    localStorage.setItem('cynea_user', JSON.stringify(currentUser));
    startTokenRefreshTimer();
    return true;
  } catch { return false; }
}

function showSessionExpired() {
  if (currentUser) {
    document.getElementById('session-email').value = currentUser.email || '';
  }
  document.getElementById('session-modal').classList.add('active');
}

async function handleSessionRelogin(e) {
  e.preventDefault();
  const email = document.getElementById('session-email').value;
  const password = document.getElementById('session-password').value;
  const role = currentUser?.role || 'client';
  const errEl = document.getElementById('session-error');

  try {
    const data = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    }).then(r => r.json());

    if (data.error) throw new Error(data.error);

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('cynea_token', token);
    localStorage.setItem('cynea_user', JSON.stringify(currentUser));
    document.getElementById('session-modal').classList.remove('active');
    startTokenRefreshTimer();
    showToast('Session restored', 'success');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

// ── Routing ─────────────────────────────────────────────────────────────

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// ── Auth ────────────────────────────────────────────────────────────────

function showLogin() {
  document.getElementById('login-modal').classList.add('active');
}

function closeLogin() {
  document.getElementById('login-modal').classList.remove('active');
  document.getElementById('login-error').classList.add('hidden');
}

function showRegister() {
  document.getElementById('register-modal').classList.add('active');
}

function closeRegister() {
  document.getElementById('register-modal').classList.remove('active');
  document.getElementById('register-error')?.classList.add('hidden');
}

function switchLoginTab(role) {
  document.getElementById('login-role').value = role;
  document.querySelectorAll('.login-tabs .tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const role = document.getElementById('login-role').value;
  const rememberMe = document.getElementById('login-remember')?.checked;
  const errEl = document.getElementById('login-error');

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role, rememberMe }),
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('cynea_token', token);
    localStorage.setItem('cynea_user', JSON.stringify(currentUser));
    closeLogin();
    startTokenRefreshTimer();

    if (currentUser.role === 'partner') {
      await loadPartnerDashboard();
    } else {
      await loadClientDashboard();
    }
    showToast(`Welcome back, ${currentUser.company_name}`, 'success');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');

  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  if (password !== confirm) {
    errEl.textContent = 'Passwords do not match';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    const data = await api('/api/auth/register-partner', {
      method: 'POST',
      body: JSON.stringify({
        company_name: document.getElementById('reg-company').value,
        email: document.getElementById('reg-email').value,
        password,
        domain: document.getElementById('reg-domain').value,
      }),
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('cynea_token', token);
    localStorage.setItem('cynea_user', JSON.stringify(currentUser));
    closeRegister();
    startTokenRefreshTimer();
    await loadPartnerDashboard();
    showToast('Welcome to Cynea AI! Start by onboarding your first client.', 'success', 6000);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function logout() {
  token = null;
  currentUser = null;
  partnerData = null;
  clientData = null;
  if (_tokenRefreshTimer) clearTimeout(_tokenRefreshTimer);
  localStorage.removeItem('cynea_token');
  localStorage.removeItem('cynea_user');
  showPage('landing-page');
  showToast('Signed out successfully', 'info');
}

// ── Init ────────────────────────────────────────────────────────────────

async function init() {
  // App-first: if logged in, go straight to dashboard
  if (token && currentUser) {
    try {
      startTokenRefreshTimer();
      if (currentUser.role === 'partner') {
        await loadPartnerDashboard();
      } else {
        await loadClientDashboard();
      }
      // Load modules in background for modules-list view
      loadPublicModules();
      return;
    } catch {
      logout();
    }
  }

  // Not logged in - show landing page
  await loadPublicModules();
}

async function loadPublicModules() {
  try {
    const data = await api('/api/modules');
    allModules = data.modules;
    renderModuleGrid(data.modules);
  } catch {}
}

function getIconClass(icon) {
  const map = {
    building: 'fas fa-building', cogs: 'fas fa-cogs', heartbeat: 'fas fa-heartbeat',
    'clipboard-check': 'fas fa-clipboard-check', 'exclamation-triangle': 'fas fa-exclamation-triangle',
    eye: 'fas fa-eye', bolt: 'fas fa-bolt', 'file-alt': 'fas fa-file-alt',
    leaf: 'fas fa-leaf', truck: 'fas fa-truck', water: 'fas fa-water', mountain: 'fas fa-mountain',
  };
  return map[icon] || 'fas fa-cube';
}

function renderModuleGrid(modules) {
  const grid = document.getElementById('module-grid');
  if (!grid) return;
  grid.innerHTML = modules.map(m => `
    <div class="module-card">
      <div class="module-category">${m.category}</div>
      <div class="module-card-header">
        <div class="module-icon"><i class="${getIconClass(m.icon)}"></i></div>
        <h3>${m.name}</h3>
      </div>
      <p>${m.description}</p>
      <span class="module-tier ${m.tier_required}">${m.tier_required}</span>
    </div>
  `).join('');
}

// ── Loading Skeletons ───────────────────────────────────────────────────

function renderSkeleton(type) {
  if (type === 'dashboard') {
    return `
      <div class="stats-grid">
        ${[1,2,3,4].map(() => '<div class="skeleton skeleton-stat"></div>').join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>`;
  }
  if (type === 'table') {
    return `<div class="card"><div class="card-body">
      ${[1,2,3,4,5].map(() => '<div class="skeleton skeleton-row"></div>').join('')}
    </div></div>`;
  }
  return '<div class="skeleton skeleton-card"></div>';
}

// ═══════════════════════════════════════════════════════════════════════════
//  PARTNER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

async function loadPartnerDashboard() {
  showPage('partner-dashboard');
  document.getElementById('partner-name').textContent = currentUser.company_name;
  const el = document.getElementById('partner-content');
  el.innerHTML = renderSkeleton('dashboard');

  try {
    partnerData = await api('/api/partners/dashboard');
    const unread = partnerData.notifications.filter(n => !n.is_read).length;
    document.getElementById('partner-notif-count').textContent = unread;
    if (unread === 0) document.getElementById('partner-notif-count').style.display = 'none';
    else document.getElementById('partner-notif-count').style.display = '';
    setupNotificationBell('partner');
    showPartnerSection('overview');
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Failed to load dashboard</h3><p>${err.message}</p><button class="btn btn-primary" onclick="loadPartnerDashboard()">Retry</button></div>`;
  }
}

function showPartnerSection(section) {
  document.querySelectorAll('#partner-dashboard .nav-item').forEach(n => n.classList.remove('active'));
  event?.target?.classList.add('active');

  const titles = {
    overview: 'Dashboard Overview', clients: 'Client Management',
    analytics: 'Analytics & Insights', onboard: 'Onboard New Client',
    'modules-list': 'AI Modules', settings: 'Settings',
  };
  document.getElementById('partner-page-title').textContent = titles[section] || 'Dashboard';
  const el = document.getElementById('partner-content');

  if (section === 'overview') renderPartnerOverview(el);
  else if (section === 'clients') renderPartnerClients(el);
  else if (section === 'analytics') renderPartnerAnalytics(el);
  else if (section === 'onboard') renderPartnerOnboard(el);
  else if (section === 'modules-list') renderModulesListView(el);
  else if (section === 'settings') renderSettings(el, 'partner');
}

function renderPartnerOverview(el) {
  const s = partnerData.stats;
  const pct = s.total_clients > 0 ? Math.round((s.active_clients / s.total_clients) * 100) : 0;

  // Show welcome panel for new partners with no clients
  const welcomeHtml = s.total_clients === 0 ? `
    <div class="welcome-panel">
      <h2>Welcome to Cynea<span style="color:var(--accent)">AI</span></h2>
      <p>Your partner account is ready. Get started by onboarding your first engineering client.</p>
      <button class="btn btn-primary btn-lg" onclick="showPartnerSection('onboard')"><i class="fas fa-user-plus"></i> Onboard Your First Client</button>
      <div class="welcome-steps">
        <div class="welcome-step">
          <i class="fas fa-user-plus"></i>
          <h4>1. Add Client</h4>
          <p>Create client accounts</p>
        </div>
        <div class="welcome-step">
          <i class="fas fa-cubes"></i>
          <h4>2. Assign Tier</h4>
          <p>Choose AI modules</p>
        </div>
        <div class="welcome-step">
          <i class="fas fa-chart-line"></i>
          <h4>3. Earn Revenue</h4>
          <p>Track usage & MRR</p>
        </div>
      </div>
    </div>` : '';

  el.innerHTML = `
    ${welcomeHtml}
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-icon blue"><i class="fas fa-users"></i></div>
        <div><h3>${s.total_clients}</h3><p>Total Clients</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon green"><i class="fas fa-check-circle"></i></div>
        <div><h3>${s.active_clients}</h3><p>Active (${pct}%)</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon amber"><i class="fas fa-brain"></i></div>
        <div><h3>${s.total_queries.toLocaleString()}</h3><p>Total AI Queries</p></div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon purple"><i class="fas fa-pound-sign"></i></div>
        <div><h3>&pound;${s.mrr.toLocaleString()}</h3><p>Monthly Recurring Revenue</p></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h2>Recent AI Queries</h2></div>
      <div class="card-body">
        ${partnerData.recent_queries.length === 0 ? `
          <div class="empty-state">
            <i class="fas fa-brain"></i>
            <h3>No queries yet</h3>
            <p>Queries will appear here once your clients start running AI analyses.</p>
          </div>` : `
        <table class="data-table">
          <thead><tr><th>Client</th><th>Module</th><th>Status</th><th>Time</th><th>Date</th></tr></thead>
          <tbody>
            ${partnerData.recent_queries.map(q => `
              <tr>
                <td>${q.client_name}</td>
                <td>${q.module_name}</td>
                <td><span class="status-badge ${q.status}">${q.status}</span></td>
                <td>${q.processing_time_ms}ms</td>
                <td>${new Date(q.created_at).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
      </div>
    </div>
  `;
}

function renderPartnerClients(el) {
  if (partnerData.clients.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <h3>No clients yet</h3>
        <p>Onboard your first client to start delivering AI engineering solutions.</p>
        <button class="btn btn-primary" onclick="showPartnerSection('onboard')"><i class="fas fa-user-plus"></i> Onboard Client</button>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>All Clients (${partnerData.clients.length})</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="copyInvitationLink()"><i class="fas fa-link"></i> Invite Link</button>
          <button class="btn btn-primary btn-sm" onclick="showPartnerSection('onboard')"><i class="fas fa-plus"></i> Add Client</button>
        </div>
      </div>
      <div class="card-body">
        <table class="data-table">
          <thead><tr><th>Company</th><th>Contact</th><th>Industry</th><th>Tier</th><th>Status</th><th>Queries</th><th>Actions</th></tr></thead>
          <tbody>
            ${partnerData.clients.map(c => `
              <tr>
                <td><strong>${c.company_name}</strong></td>
                <td>${c.contact_name}<br><span style="font-size:11px;color:var(--text-muted)">${c.email}</span></td>
                <td>${c.industry || '—'}</td>
                <td><span class="tier-badge ${c.subscription_tier}">${c.subscription_tier}</span></td>
                <td><span class="status-badge ${c.subscription_status}">${c.subscription_status}</span></td>
                <td>
                  ${c.monthly_queries} / ${c.query_limit}
                  <div class="usage-bar" style="width:120px;margin-top:4px">
                    <div class="usage-bar-fill ${c.monthly_queries / c.query_limit > 0.8 ? 'red' : c.monthly_queries / c.query_limit > 0.5 ? 'amber' : 'green'}"
                         style="width:${Math.min(100, (c.monthly_queries / c.query_limit) * 100)}%"></div>
                  </div>
                </td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="upgradeClient('${c.id}','${c.subscription_tier}')" title="Upgrade tier"><i class="fas fa-arrow-up"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function copyInvitationLink() {
  const link = `${window.location.origin}?invite=${currentUser.id}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Invitation link copied to clipboard', 'success');
  }).catch(() => {
    showToast('Failed to copy link', 'error');
  });
}

async function upgradeClient(clientId, currentTier) {
  const tiers = ['standard', 'professional', 'enterprise'];
  const idx = tiers.indexOf(currentTier);
  if (idx >= tiers.length - 1) { showToast('Already on the highest tier', 'warning'); return; }
  const newTier = tiers[idx + 1];
  if (!confirm(`Upgrade client to ${newTier}?`)) return;
  try {
    await api(`/api/partners/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify({ subscription_tier: newTier }),
    });
    showToast(`Client upgraded to ${newTier}`, 'success');
    await loadPartnerDashboard();
  } catch (err) { showToast(err.message, 'error'); }
}

async function renderPartnerAnalytics(el) {
  el.innerHTML = renderSkeleton('dashboard');
  try {
    const analytics = await api('/api/partners/analytics');

    if (analytics.module_usage.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-chart-bar"></i>
          <h3>No analytics data yet</h3>
          <p>Analytics will populate as your clients run AI analyses.</p>
        </div>`;
      return;
    }

    const maxCount = Math.max(...analytics.module_usage.map(m => m.query_count), 1);

    el.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>AI Module Usage</h2></div>
        <div class="card-body">
          <div class="chart-bars" style="margin-bottom:32px">
            ${analytics.module_usage.map(m => `
              <div class="chart-bar" style="height:${Math.max(10, (m.query_count / maxCount) * 100)}%">
                <span class="chart-bar-value">${m.query_count}</span>
                <span class="chart-bar-label">${m.name.split(' ')[0]}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Tier Distribution</h2></div>
        <div class="card-body">
          <div class="stats-grid">
            ${analytics.tier_distribution.map(t => `
              <div class="stat-card">
                <div class="stat-card-icon ${t.tier === 'standard' ? 'blue' : t.tier === 'professional' ? 'amber' : 'purple'}">
                  <i class="fas fa-layer-group"></i>
                </div>
                <div>
                  <h3>${t.count}</h3>
                  <p>${t.tier} clients</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error</h3><p>${err.message}</p><button class="btn btn-primary btn-sm" onclick="renderPartnerAnalytics(document.getElementById('partner-content'))">Retry</button></div>`;
  }
}

function renderPartnerOnboard(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Onboard New Client</h2>
        <button class="btn btn-outline btn-sm" onclick="copyInvitationLink()"><i class="fas fa-link"></i> Copy Invite Link</button>
      </div>
      <div class="card-body">
        <div id="onboard-success" class="success-msg hidden"></div>
        <form class="onboard-form" onsubmit="handleOnboard(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Company Name *</label>
              <input type="text" id="ob-company" required placeholder="e.g. BuildRight Construction">
            </div>
            <div class="form-group">
              <label>Contact Name *</label>
              <input type="text" id="ob-contact" required placeholder="e.g. John Smith">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email *</label>
              <input type="email" id="ob-email" required placeholder="john@buildright.com">
            </div>
            <div class="form-group">
              <label>Password *</label>
              <input type="password" id="ob-password" required placeholder="Minimum 6 characters" minlength="6">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Industry</label>
              <select id="ob-industry">
                <option value="">Select industry...</option>
                <option>Construction</option>
                <option>Manufacturing</option>
                <option>Oil & Gas</option>
                <option>Power & Energy</option>
                <option>Water & Utilities</option>
                <option>Transportation</option>
                <option>Mining</option>
                <option>Aerospace</option>
                <option>Defence</option>
                <option>Pharmaceutical</option>
                <option>Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Subscription Tier</label>
              <select id="ob-tier">
                <option value="standard">Standard (&pound;299/mo)</option>
                <option value="professional">Professional (&pound;599/mo)</option>
                <option value="enterprise">Enterprise (&pound;1,299/mo)</option>
              </select>
            </div>
          </div>
          <div id="onboard-error" class="error-msg hidden"></div>
          <button type="submit" class="btn btn-primary btn-lg"><i class="fas fa-user-plus"></i> Onboard Client</button>
        </form>
      </div>
    </div>
  `;
}

async function handleOnboard(e) {
  e.preventDefault();
  const errEl = document.getElementById('onboard-error');
  const successEl = document.getElementById('onboard-success');
  errEl.classList.add('hidden');
  successEl.classList.add('hidden');

  try {
    const data = await api('/api/partners/clients', {
      method: 'POST',
      body: JSON.stringify({
        company_name: document.getElementById('ob-company').value,
        contact_name: document.getElementById('ob-contact').value,
        email: document.getElementById('ob-email').value,
        password: document.getElementById('ob-password').value,
        industry: document.getElementById('ob-industry').value,
        subscription_tier: document.getElementById('ob-tier').value,
      }),
    });
    successEl.textContent = `${data.company_name} has been onboarded successfully on the ${data.subscription_tier} tier.`;
    successEl.classList.remove('hidden');
    e.target.reset();
    showToast(`${data.company_name} onboarded successfully`, 'success');
    partnerData = await api('/api/partners/dashboard');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function renderModulesListView(el) {
  if (!allModules.length) {
    el.innerHTML = renderSkeleton('table');
    loadPublicModules().then(() => renderModulesListView(el));
    return;
  }
  const categories = [...new Set(allModules.map(m => m.category))];
  el.innerHTML = categories.map(cat => `
    <h3 style="margin:20px 0 12px;font-size:14px;color:var(--accent);text-transform:uppercase;letter-spacing:1px">${cat}</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;margin-bottom:8px">
      ${allModules.filter(m => m.category === cat).map(m => `
        <div class="module-card" style="margin:0">
          <div class="module-card-header">
            <div class="module-icon"><i class="${getIconClass(m.icon)}"></i></div>
            <div>
              <h3>${m.name}</h3>
              <span class="module-tier ${m.tier_required}" style="margin:0">${m.tier_required}</span>
            </div>
          </div>
          <p>${m.description}</p>
        </div>
      `).join('')}
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════════════════
//  CLIENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

async function loadClientDashboard() {
  showPage('client-dashboard');
  document.getElementById('client-name').textContent = currentUser.company_name;
  const el = document.getElementById('client-content');
  el.innerHTML = renderSkeleton('dashboard');

  try {
    clientData = await api('/api/clients/dashboard');
    const unread = clientData.notifications.filter(n => !n.is_read).length;
    document.getElementById('client-notif-count').textContent = unread;
    if (unread === 0) document.getElementById('client-notif-count').style.display = 'none';
    else document.getElementById('client-notif-count').style.display = '';
    setupNotificationBell('client');

    const modData = await api('/api/clients/modules');
    clientData.modules = modData.modules;
    clientData.current_tier = modData.current_tier;

    showClientSection('overview');
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Failed to load dashboard</h3><p>${err.message}</p><button class="btn btn-primary" onclick="loadClientDashboard()">Retry</button></div>`;
  }
}

function showClientSection(section) {
  document.querySelectorAll('#client-dashboard .nav-item').forEach(n => n.classList.remove('active'));
  event?.target?.classList.add('active');

  const titles = {
    overview: 'Dashboard Overview', 'ai-modules': 'AI Modules',
    analysis: 'Run AI Analysis', history: 'Query History', settings: 'Settings',
  };
  document.getElementById('client-page-title').textContent = titles[section] || 'Dashboard';
  const el = document.getElementById('client-content');

  if (section === 'overview') renderClientOverview(el);
  else if (section === 'ai-modules') renderClientModules(el);
  else if (section === 'analysis') renderAnalysisForm(el);
  else if (section === 'history') renderQueryHistory(el);
  else if (section === 'settings') renderSettings(el, 'client');
}

function renderClientOverview(el) {
  const c = clientData.client;
  const usagePct = Math.round((c.monthly_queries / c.query_limit) * 100);
  const usageColor = usagePct > 80 ? 'red' : usagePct > 50 ? 'amber' : 'green';

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-icon cyan"><i class="fas fa-building"></i></div>
        <div>
          <h3 style="font-size:16px">${c.company_name}</h3>
          <p>${c.industry || 'Engineering'}</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon ${c.subscription_tier === 'enterprise' ? 'purple' : c.subscription_tier === 'professional' ? 'amber' : 'blue'}">
          <i class="fas fa-layer-group"></i>
        </div>
        <div>
          <h3 style="font-size:16px;text-transform:capitalize">${c.subscription_tier}</h3>
          <p>Subscription Tier</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon green"><i class="fas fa-brain"></i></div>
        <div>
          <h3>${c.monthly_queries}</h3>
          <p>Queries This Month</p>
          <div class="usage-bar-container">
            <div class="usage-bar"><div class="usage-bar-fill ${usageColor}" style="width:${usagePct}%"></div></div>
            <div class="usage-text">${c.monthly_queries} / ${c.query_limit} (${usagePct}%)</div>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-icon amber"><i class="fas fa-cubes"></i></div>
        <div>
          <h3>${clientData.modules ? clientData.modules.filter(m => m.accessible).length : 0}</h3>
          <p>Available Modules</p>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header">
          <h2>Recent Analyses</h2>
          <button class="btn btn-primary btn-sm" onclick="showClientSection('analysis')"><i class="fas fa-play"></i> New</button>
        </div>
        <div class="card-body">
          ${clientData.recent_queries.length === 0 ? `
            <div class="empty-state">
              <i class="fas fa-flask"></i>
              <h3>No analyses yet</h3>
              <p>Run your first AI analysis to see results here.</p>
              <button class="btn btn-primary btn-sm" onclick="showClientSection('analysis')">Run Analysis</button>
            </div>` : `
          <table class="data-table">
            <thead><tr><th>Module</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              ${clientData.recent_queries.slice(0, 8).map(q => `
                <tr style="cursor:pointer" onclick="viewQueryResult('${q.id}')">
                  <td><i class="${getIconClass(q.icon)}" style="margin-right:8px;color:var(--accent)"></i>${q.module_name}</td>
                  <td><span class="status-badge ${q.status}">${q.status}</span></td>
                  <td>${q.processing_time_ms}ms</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Module Usage</h2></div>
        <div class="card-body">
          ${clientData.module_usage.length === 0 ? `
            <div class="empty-state">
              <i class="fas fa-chart-pie"></i>
              <h3>No usage data</h3>
              <p>Module usage stats will appear after your first analysis.</p>
            </div>` : `
          ${clientData.module_usage.map(m => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:13px;font-weight:500">${m.name}</span>
              <span style="font-size:13px;color:var(--accent);font-weight:700">${m.uses}</span>
            </div>
          `).join('')}`}
        </div>
      </div>
    </div>
  `;
}

function renderClientModules(el) {
  if (!clientData.modules) return;
  const accessible = clientData.modules.filter(m => m.accessible);
  const locked = clientData.modules.filter(m => !m.accessible);

  el.innerHTML = `
    <p style="color:var(--text-secondary);margin-bottom:20px">Your <strong style="text-transform:capitalize">${clientData.current_tier}</strong> tier gives you access to <strong>${accessible.length}</strong> of ${clientData.modules.length} AI modules.</p>

    <h3 style="margin-bottom:12px;font-size:14px;color:var(--success)"><i class="fas fa-lock-open" style="margin-right:8px"></i>Available Modules (${accessible.length})</h3>
    <div class="module-grid" style="margin-bottom:32px">
      ${accessible.map(m => `
        <div class="module-card" style="cursor:pointer" onclick="startAnalysisWithModule('${m.slug}')">
          <div class="module-category">${m.category}</div>
          <div class="module-card-header">
            <div class="module-icon"><i class="${getIconClass(m.icon)}"></i></div>
            <h3>${m.name}</h3>
          </div>
          <p>${m.description}</p>
          <div style="margin-top:12px"><button class="btn btn-primary btn-sm"><i class="fas fa-play"></i> Run Analysis</button></div>
        </div>
      `).join('')}
    </div>

    ${locked.length > 0 ? `
      <h3 style="margin-bottom:12px;font-size:14px;color:var(--text-muted)"><i class="fas fa-lock" style="margin-right:8px"></i>Upgrade Required (${locked.length})</h3>
      <div class="module-grid">
        ${locked.map(m => `
          <div class="module-card" style="opacity:0.5">
            <div class="module-category">${m.category}</div>
            <div class="module-card-header">
              <div class="module-icon"><i class="${getIconClass(m.icon)}"></i></div>
              <h3>${m.name}</h3>
            </div>
            <p>${m.description}</p>
            <span class="module-tier ${m.tier_required}">Requires ${m.tier_required}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

let selectedModule = null;

function startAnalysisWithModule(slug) {
  selectedModule = slug;
  showClientSection('analysis');
}

function renderAnalysisForm(el) {
  if (!clientData.modules) return;
  const accessible = clientData.modules.filter(m => m.accessible);

  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h2>Select AI Module</h2></div>
      <div class="card-body">
        <div class="module-select-grid">
          ${accessible.map(m => `
            <div class="module-select-card ${selectedModule === m.slug ? 'selected' : ''}"
                 onclick="selectModule('${m.slug}')">
              <div class="mini-icon"><i class="${getIconClass(m.icon)}"></i></div>
              <div>
                <h4>${m.name}</h4>
                <span class="cat">${m.category}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="card" id="analysis-input-card" ${!selectedModule ? 'style="display:none"' : ''}>
      <div class="card-header"><h2>Analysis Input</h2></div>
      <div class="card-body">
        <div id="dynamic-input-form"></div>
        <button class="btn btn-primary btn-lg" onclick="runAnalysis()" id="run-btn">
          <i class="fas fa-play-circle"></i> Run Analysis
        </button>
      </div>
    </div>

    <div id="analysis-result-container"></div>
  `;

  if (selectedModule) renderDynamicForm(selectedModule);
}

function selectModule(slug) {
  selectedModule = slug;
  document.querySelectorAll('.module-select-card').forEach(c => c.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  document.getElementById('analysis-input-card').style.display = 'block';
  renderDynamicForm(slug);
  document.getElementById('analysis-result-container').innerHTML = '';
}

function renderDynamicForm(slug) {
  const forms = {
    'structural-analysis': `
      <div class="form-row">
        <div class="form-group"><label>Analysis Type</label><select id="inp-type"><option value="beam">Beam</option><option value="column">Column</option><option value="frame">Frame</option><option value="foundation">Foundation</option></select></div>
        <div class="form-group"><label>Material</label><select id="inp-material"><option value="steel_s355">Steel S355</option><option value="steel_s275">Steel S275</option><option value="concrete_c30">Concrete C30/37</option><option value="timber_c24">Timber C24</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Span (m)</label><input type="number" id="inp-span" value="8" min="1" max="100"></div>
        <div class="form-group"><label>Applied Load (kN/m)</label><input type="number" id="inp-load" value="35" min="1" max="1000"></div>
      </div>`,
    'design-optimisation': `
      <div class="form-row">
        <div class="form-group"><label>Component Type</label><select id="inp-component"><option>Bracket</option><option>Housing</option><option>Shaft</option><option>Plate</option></select></div>
        <div class="form-group"><label>Target Mass Reduction (%)</label><input type="number" id="inp-target" value="25" min="5" max="60"></div>
      </div>
      <div class="form-group"><label>Constraints / Notes</label><textarea id="inp-notes" placeholder="e.g. Must maintain bolt hole positions, max 2mm deflection"></textarea></div>`,
    'predictive-maintenance': `
      <div class="form-row">
        <div class="form-group"><label>Equipment ID</label><input type="text" id="inp-equipment" value="CRANE-07" placeholder="e.g. PUMP-01"></div>
        <div class="form-group"><label>Operating Hours</label><input type="number" id="inp-hours" value="12400"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Vibration RMS (mm/s)</label><input type="number" id="inp-vibration" value="4.2" step="0.1"></div>
        <div class="form-group"><label>Temperature (&deg;C)</label><input type="number" id="inp-temp" value="78"></div>
      </div>`,
    'compliance-checker': `
      <div class="form-row">
        <div class="form-group"><label>Standard</label><select id="inp-standard"><option value="eurocode_2">Eurocode 2 (Concrete)</option><option value="eurocode_3">Eurocode 3 (Steel)</option><option value="asme_b31">ASME B31.3 (Piping)</option><option value="iso_9001">ISO 9001:2015</option><option value="bs_5950">BS 5950</option></select></div>
        <div class="form-group"><label>Document Reference</label><input type="text" id="inp-docref" placeholder="e.g. FDN-Design-Rev3.pdf"></div>
      </div>
      <div class="form-group"><label>Scope Notes</label><textarea id="inp-scope" placeholder="Describe what to check..."></textarea></div>`,
    'risk-analyser': `
      <div class="form-row">
        <div class="form-group"><label>Project Name</label><input type="text" id="inp-project" placeholder="e.g. Highway Bridge Retrofit"></div>
        <div class="form-group"><label>Budget (&pound;)</label><input type="number" id="inp-budget" value="2400000"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Timeline (months)</label><input type="number" id="inp-timeline" value="18"></div>
        <div class="form-group"><label>Project Phase</label><select id="inp-phase"><option>Concept</option><option>Detailed Design</option><option>Construction</option><option>Commissioning</option></select></div>
      </div>`,
  };

  const defaultForm = `
    <div class="form-group"><label>Analysis Parameters (JSON)</label>
      <textarea id="inp-json" style="font-family:monospace;min-height:120px" placeholder='{"param": "value"}'>{}</textarea>
    </div>`;

  document.getElementById('dynamic-input-form').innerHTML = forms[slug] || defaultForm;
}

function gatherInput() {
  if (!selectedModule) return {};
  const inputs = {
    'structural-analysis': () => ({
      type: document.getElementById('inp-type')?.value,
      material: document.getElementById('inp-material')?.value,
      span: +document.getElementById('inp-span')?.value,
      load: +document.getElementById('inp-load')?.value,
    }),
    'design-optimisation': () => ({
      component: document.getElementById('inp-component')?.value,
      target_reduction: +document.getElementById('inp-target')?.value,
      notes: document.getElementById('inp-notes')?.value,
    }),
    'predictive-maintenance': () => ({
      equipment: document.getElementById('inp-equipment')?.value,
      hours: +document.getElementById('inp-hours')?.value,
      vibration_rms: +document.getElementById('inp-vibration')?.value,
      temp: +document.getElementById('inp-temp')?.value,
    }),
    'compliance-checker': () => ({
      standard: document.getElementById('inp-standard')?.value,
      document: document.getElementById('inp-docref')?.value,
      scope: document.getElementById('inp-scope')?.value,
    }),
    'risk-analyser': () => ({
      project: document.getElementById('inp-project')?.value,
      budget: +document.getElementById('inp-budget')?.value,
      timeline_months: +document.getElementById('inp-timeline')?.value,
      phase: document.getElementById('inp-phase')?.value,
    }),
  };
  const fn = inputs[selectedModule];
  if (fn) return fn();
  try { return JSON.parse(document.getElementById('inp-json')?.value || '{}'); } catch { return {}; }
}

async function runAnalysis() {
  if (!selectedModule) return;
  const btn = document.getElementById('run-btn');
  const container = document.getElementById('analysis-result-container');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Analysing...';
  container.innerHTML = '<div style="text-align:center;padding:40px"><span class="loading-spinner" style="width:40px;height:40px"></span><p style="margin-top:12px;color:var(--text-secondary)">Running AI analysis...</p></div>';

  try {
    const result = await api('/api/clients/query', {
      method: 'POST',
      body: JSON.stringify({ module_slug: selectedModule, input_data: gatherInput() }),
    });
    renderResult(container, result);
    clientData.client.monthly_queries = result.usage.used;
    showToast(`Analysis complete (${result.processing_time_ms}ms)`, 'success');
  } catch (err) {
    container.innerHTML = `<div class="analysis-result"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Analysis Failed</h3><p>${err.message}</p></div></div>`;
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-play-circle"></i> Run Analysis';
  }
}

function renderResult(container, data) {
  const result = data.result;
  const entries = Object.entries(result).filter(([k]) => k !== 'error');

  container.innerHTML = `
    <div class="analysis-result">
      <div class="result-header">
        <h3><i class="fas fa-check-circle" style="color:var(--success);margin-right:8px"></i>${data.module} — Complete</h3>
        <span style="font-size:12px;color:var(--text-muted)">Processed in ${data.processing_time_ms}ms</span>
      </div>
      <div class="result-grid">
        ${entries.map(([key, val]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          let display = val;
          let cls = '';
          if (typeof val === 'object' && val !== null) {
            if (Array.isArray(val)) {
              display = val.length > 0 && typeof val[0] === 'object'
                ? val.map(v => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">${Object.entries(v).map(([k2,v2]) => `<strong>${k2}:</strong> ${v2}`).join(' | ')}</div>`).join('')
                : val.map(v => `<div style="font-size:12px;padding:2px 0">- ${v}</div>`).join('');
              return `<div class="result-item" style="grid-column:span 2"><div class="label">${label}</div><div>${display}</div></div>`;
            } else {
              display = Object.entries(val).map(([k2, v2]) => `<div style="font-size:12px"><strong>${k2}:</strong> ${v2}</div>`).join('');
              return `<div class="result-item" style="grid-column:span 2"><div class="label">${label}</div><div>${display}</div></div>`;
            }
          }
          if (typeof val === 'string') {
            if (['PASS', 'COMPLIANT', 'STABLE', 'NORMAL', 'LOW', 'ROUTINE'].includes(val)) cls = 'pass';
            else if (['FAIL', 'ACTION REQUIRED', 'CRITICAL', 'HIGH'].includes(val)) cls = 'fail';
            else if (['REVIEW REQUIRED', 'MINOR GAPS', 'MEDIUM', 'ELEVATED', 'INCREASING'].includes(val)) cls = 'warn';
          }
          if (typeof val === 'number' && key.includes('score') && val > 0.7) cls = 'pass';
          if (typeof val === 'number' && key.includes('risk') && val > 0.6) cls = 'fail';
          return `<div class="result-item"><div class="label">${label}</div><div class="value ${cls}">${display}</div></div>`;
        }).join('')}
      </div>
      <div class="result-actions">
        <div>
          <span style="font-size:12px;color:var(--text-muted)">Query ID: ${data.query_id}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-left:16px">Usage: ${data.usage.used} / ${data.usage.limit}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="exportResultAsCSV(${JSON.stringify(data.result).replace(/"/g, '&quot;')}, '${data.module}')"><i class="fas fa-file-csv"></i> Export CSV</button>
          <button class="btn btn-outline btn-sm" onclick="window.print()"><i class="fas fa-print"></i> Print / PDF</button>
        </div>
      </div>
    </div>
  `;
}

// ── Export Functions ─────────────────────────────────────────────────────

function exportResultAsCSV(result, moduleName) {
  if (typeof result === 'string') {
    try { result = JSON.parse(result); } catch { return showToast('Cannot parse result data', 'error'); }
  }
  const rows = [['Field', 'Value']];
  const flatten = (obj, prefix = '') => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        flatten(v, key);
      } else if (Array.isArray(v)) {
        rows.push([key, JSON.stringify(v)]);
      } else {
        rows.push([key, String(v)]);
      }
    }
  };
  flatten(result);

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cynea-${(moduleName || 'analysis').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported', 'success');
}

function exportQueryHistoryCSV(queries) {
  const rows = [['Module', 'Category', 'Status', 'Processing Time (ms)', 'Date']];
  queries.forEach(q => {
    rows.push([q.module_name, q.category, q.status, q.processing_time_ms, new Date(q.created_at).toLocaleString()]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cynea-query-history-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('History exported', 'success');
}

// ── Query History with Filters ──────────────────────────────────────────

let _lastQueryData = null;

async function renderQueryHistory(el) {
  el.innerHTML = renderSkeleton('table');
  try {
    const data = await api('/api/clients/queries?limit=25');
    _lastQueryData = data;
    renderQueryHistoryContent(el, data);
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

function renderQueryHistoryContent(el, data) {
  const moduleOptions = clientData.modules
    ? clientData.modules.filter(m => m.accessible).map(m => `<option value="${m.slug}">${m.name}</option>`).join('')
    : '';

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>Query History (${data.total} total)</h2>
        ${data.queries.length > 0 ? `<button class="btn btn-outline btn-sm" onclick="exportQueryHistoryCSV(${JSON.stringify(data.queries).replace(/"/g, '&quot;')})"><i class="fas fa-download"></i> Export All</button>` : ''}
      </div>
      <div class="card-body">
        <div class="filter-bar">
          <span class="filter-label">Filter:</span>
          <select id="filter-module" onchange="applyQueryFilters()">
            <option value="">All Modules</option>
            ${moduleOptions}
          </select>
          <select id="filter-status" onchange="applyQueryFilters()">
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <input type="date" id="filter-from" onchange="applyQueryFilters()" title="From date">
          <input type="date" id="filter-to" onchange="applyQueryFilters()" title="To date">
          <button class="btn btn-ghost btn-sm" onclick="clearQueryFilters()"><i class="fas fa-times"></i> Clear</button>
        </div>
        <div id="query-table-body">
          ${renderQueryTable(data.queries)}
        </div>
      </div>
    </div>
  `;
}

function renderQueryTable(queries) {
  if (queries.length === 0) {
    return `<div class="empty-state">
      <i class="fas fa-history"></i>
      <h3>No queries found</h3>
      <p>Run an AI analysis to see your query history here.</p>
      <button class="btn btn-primary btn-sm" onclick="showClientSection('analysis')">Run Analysis</button>
    </div>`;
  }
  return `
    <table class="data-table">
      <thead><tr><th>Module</th><th>Category</th><th>Status</th><th>Processing Time</th><th>Date</th><th></th></tr></thead>
      <tbody>
        ${queries.map(q => `
          <tr>
            <td><i class="${getIconClass(q.icon)}" style="margin-right:8px;color:var(--accent)"></i>${q.module_name}</td>
            <td>${q.category}</td>
            <td><span class="status-badge ${q.status}">${q.status}</span></td>
            <td>${q.processing_time_ms}ms</td>
            <td>${new Date(q.created_at).toLocaleString()}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="viewQueryResult('${q.id}')" title="View result"><i class="fas fa-eye"></i></button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

async function applyQueryFilters() {
  const module_slug = document.getElementById('filter-module')?.value;
  const status = document.getElementById('filter-status')?.value;
  const date_from = document.getElementById('filter-from')?.value;
  const date_to = document.getElementById('filter-to')?.value;

  const params = new URLSearchParams({ limit: '25' });
  if (module_slug) params.set('module_slug', module_slug);
  if (status) params.set('status', status);
  if (date_from) params.set('date_from', date_from);
  if (date_to) params.set('date_to', date_to);

  try {
    const data = await api(`/api/clients/queries?${params}`);
    _lastQueryData = data;
    document.getElementById('query-table-body').innerHTML = renderQueryTable(data.queries);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function clearQueryFilters() {
  document.getElementById('filter-module').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';
  applyQueryFilters();
}

async function viewQueryResult(queryId) {
  try {
    const q = await api(`/api/clients/queries/${queryId}`);
    const el = document.getElementById('client-content');
    document.getElementById('client-page-title').textContent = `Analysis Result — ${q.module_name}`;

    el.innerHTML = `
      <button class="btn btn-ghost" onclick="showClientSection('history')" style="margin-bottom:16px">
        <i class="fas fa-arrow-left"></i> Back to History
      </button>
      <div id="analysis-result-container"></div>
    `;

    renderResult(document.getElementById('analysis-result-container'), {
      module: q.module_name,
      query_id: q.id,
      processing_time_ms: q.processing_time_ms,
      result: q.result_data,
      usage: { used: clientData.client.monthly_queries, limit: clientData.client.query_limit },
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

async function renderSettings(el, role) {
  el.innerHTML = renderSkeleton('dashboard');
  try {
    const profile = await api('/api/auth/profile');

    el.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>Profile</h2></div>
        <div class="card-body">
          <div class="settings-section">
            <div class="settings-info"><span class="label">Company</span><span class="value">${profile.company_name}</span></div>
            <div class="settings-info"><span class="label">Email</span><span class="value">${profile.email}</span></div>
            ${role === 'client' ? `
              <div class="settings-info"><span class="label">Contact</span><span class="value">${profile.contact_name || '—'}</span></div>
              <div class="settings-info"><span class="label">Industry</span><span class="value">${profile.industry || '—'}</span></div>
              <div class="settings-info"><span class="label">Tier</span><span class="value" style="text-transform:capitalize">${profile.subscription_tier}</span></div>
              <div class="settings-info"><span class="label">Usage</span><span class="value">${profile.monthly_queries} / ${profile.query_limit} queries</span></div>
            ` : `
              <div class="settings-info"><span class="label">Domain</span><span class="value">${profile.domain || '—'}</span></div>
              <div class="settings-info"><span class="label">Plan</span><span class="value" style="text-transform:capitalize">${profile.plan || 'professional'}</span></div>
            `}
            <div class="settings-info"><span class="label">Member Since</span><span class="value">${profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</span></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Edit Profile</h2></div>
        <div class="card-body">
          <form class="onboard-form" onsubmit="handleUpdateProfile(event, '${role}')">
            <div class="form-row">
              <div class="form-group">
                <label>Company Name</label>
                <input type="text" id="settings-company" value="${profile.company_name}">
              </div>
              ${role === 'client' ? `
                <div class="form-group">
                  <label>Contact Name</label>
                  <input type="text" id="settings-contact" value="${profile.contact_name || ''}">
                </div>
              ` : `
                <div class="form-group">
                  <label>Domain</label>
                  <input type="text" id="settings-domain" value="${profile.domain || ''}">
                </div>
              `}
            </div>
            ${role === 'client' ? `
              <div class="form-group" style="max-width:300px">
                <label>Industry</label>
                <select id="settings-industry">
                  <option value="">Select industry...</option>
                  ${['Construction','Manufacturing','Oil & Gas','Power & Energy','Water & Utilities','Transportation','Mining','Aerospace','Defence','Pharmaceutical','Other']
                    .map(i => `<option ${profile.industry === i ? 'selected' : ''}>${i}</option>`).join('')}
                </select>
              </div>
            ` : ''}
            <div id="profile-error" class="error-msg hidden"></div>
            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Changes</button>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Change Password</h2></div>
        <div class="card-body">
          <form class="onboard-form" onsubmit="handleChangePassword(event)">
            <div class="form-group" style="max-width:300px">
              <label>Current Password</label>
              <input type="password" id="pw-current" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>New Password</label>
                <input type="password" id="pw-new" required minlength="6" placeholder="Min 6 characters">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" id="pw-confirm" required minlength="6">
              </div>
            </div>
            <div id="password-error" class="error-msg hidden"></div>
            <div id="password-success" class="success-msg hidden"></div>
            <button type="submit" class="btn btn-outline"><i class="fas fa-key"></i> Update Password</button>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Session</h2></div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Sign out of your current session. You'll need to sign in again to access the platform.</p>
          <button class="btn btn-danger btn-sm" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Failed to load settings</h3><p>${err.message}</p></div>`;
  }
}

async function handleUpdateProfile(e, role) {
  e.preventDefault();
  const errEl = document.getElementById('profile-error');
  errEl.classList.add('hidden');

  const body = { company_name: document.getElementById('settings-company').value };
  if (role === 'client') {
    body.contact_name = document.getElementById('settings-contact')?.value;
    body.industry = document.getElementById('settings-industry')?.value;
  } else {
    body.domain = document.getElementById('settings-domain')?.value;
  }

  try {
    await api('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(body) });
    // Update local data
    if (body.company_name) {
      currentUser.company_name = body.company_name;
      localStorage.setItem('cynea_user', JSON.stringify(currentUser));
      const nameEl = document.getElementById(role === 'partner' ? 'partner-name' : 'client-name');
      if (nameEl) nameEl.textContent = body.company_name;
    }
    showToast('Profile updated', 'success');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

async function handleChangePassword(e) {
  e.preventDefault();
  const errEl = document.getElementById('password-error');
  const successEl = document.getElementById('password-success');
  errEl.classList.add('hidden');
  successEl.classList.add('hidden');

  const newPw = document.getElementById('pw-new').value;
  const confirmPw = document.getElementById('pw-confirm').value;
  if (newPw !== confirmPw) {
    errEl.textContent = 'Passwords do not match';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await api('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: document.getElementById('pw-current').value,
        new_password: newPw,
      }),
    });
    successEl.textContent = 'Password updated successfully';
    successEl.classList.remove('hidden');
    e.target.reset();
    showToast('Password changed', 'success');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  NOTIFICATION DROPDOWN
// ═══════════════════════════════════════════════════════════════════════════

function setupNotificationBell(role) {
  const bellEl = document.getElementById(`${role}-notifications`);
  if (!bellEl) return;

  // Remove old dropdown if exists
  const old = bellEl.querySelector('.notif-dropdown');
  if (old) old.remove();

  const notifications = role === 'partner' ? partnerData.notifications : clientData.notifications;
  const dropdown = document.createElement('div');
  dropdown.className = 'notif-dropdown';
  dropdown.innerHTML = `
    <div class="notif-dropdown-header">
      <h4>Notifications</h4>
      <button class="btn btn-ghost btn-sm" onclick="markAllNotificationsRead('${role}')">Mark all read</button>
    </div>
    ${notifications.length === 0 ? '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px">No notifications</div>' :
    notifications.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markNotificationRead('${role}', '${n.id}', this)">
        <div class="notif-dot ${n.is_read ? 'read' : 'unread'}"></div>
        <div>
          <strong>${n.title}</strong>
          <p>${n.message || ''}</p>
          ${n.created_at ? `<span class="notif-time">${new Date(n.created_at).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    `).join('')}
  `;
  bellEl.appendChild(dropdown);
  bellEl.style.position = 'relative';

  bellEl.onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  };

  document.addEventListener('click', () => dropdown.classList.remove('show'), { once: false });
}

async function markNotificationRead(role, notifId, el) {
  try {
    const endpoint = role === 'partner' ? '/api/partners/notifications' : '/api/clients/notifications';
    await api(`${endpoint}/${notifId}/read`, { method: 'PATCH' });
    if (el) {
      el.classList.remove('unread');
      const dot = el.querySelector('.notif-dot');
      if (dot) { dot.classList.remove('unread'); dot.classList.add('read'); }
    }
    updateNotifCount(role);
  } catch {}
}

async function markAllNotificationsRead(role) {
  try {
    const endpoint = role === 'partner' ? '/api/partners/notifications/read-all' : '/api/clients/notifications/read-all';
    await api(endpoint, { method: 'POST' });
    const notifications = role === 'partner' ? partnerData.notifications : clientData.notifications;
    notifications.forEach(n => n.is_read = 1);
    setupNotificationBell(role);
    updateNotifCount(role);
    showToast('All notifications marked as read', 'info');
  } catch {}
}

function updateNotifCount(role) {
  const notifications = role === 'partner' ? partnerData.notifications : clientData.notifications;
  const unread = notifications.filter(n => !n.is_read).length;
  const badge = document.getElementById(`${role}-notif-count`);
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread === 0 ? 'none' : '';
  }
}

// ── Handle invitation links ─────────────────────────────────────────────

function checkForInvitation() {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get('invite');
  if (invite && !token) {
    // Show a client registration form pre-filled with partner_id
    showClientRegistration(invite);
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }
}

function showClientRegistration(partnerId) {
  const modal = document.getElementById('register-modal');
  modal.classList.add('active');
  // Override the form to be client registration
  const form = document.getElementById('register-form');
  form.innerHTML = `
    <input type="hidden" id="reg-partner-id" value="${partnerId}">
    <div class="form-group">
      <label>Company Name</label>
      <input type="text" id="reg-company" placeholder="Your company" required>
    </div>
    <div class="form-group">
      <label>Contact Name</label>
      <input type="text" id="reg-contact" placeholder="Your name" required>
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="reg-email" placeholder="you@company.com" required>
    </div>
    <div class="form-group">
      <label>Industry</label>
      <select id="reg-industry">
        <option value="">Select industry...</option>
        <option>Construction</option><option>Manufacturing</option><option>Oil & Gas</option>
        <option>Power & Energy</option><option>Water & Utilities</option><option>Transportation</option>
        <option>Mining</option><option>Aerospace</option><option>Defence</option>
        <option>Pharmaceutical</option><option>Other</option>
      </select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="reg-password" placeholder="Min 6 characters" required minlength="6">
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <input type="password" id="reg-confirm" placeholder="Confirm" required minlength="6">
      </div>
    </div>
    <div id="register-error" class="error-msg hidden"></div>
    <button type="submit" class="btn btn-primary btn-block btn-lg"><i class="fas fa-rocket"></i> Create Account</button>
  `;
  // Update header
  modal.querySelector('.login-header h2').textContent = 'Join as Client';
  modal.querySelector('.login-header p').textContent = 'Your partner has invited you to the platform';
  form.onsubmit = handleClientRegister;
}

async function handleClientRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');

  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  if (password !== confirm) {
    errEl.textContent = 'Passwords do not match';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    const data = await api('/api/auth/register-client', {
      method: 'POST',
      body: JSON.stringify({
        company_name: document.getElementById('reg-company').value,
        contact_name: document.getElementById('reg-contact').value,
        email: document.getElementById('reg-email').value,
        password,
        industry: document.getElementById('reg-industry')?.value,
        partner_id: document.getElementById('reg-partner-id').value,
      }),
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('cynea_token', token);
    localStorage.setItem('cynea_user', JSON.stringify(currentUser));
    closeRegister();
    startTokenRefreshTimer();
    await loadClientDashboard();
    showToast('Welcome to Cynea AI!', 'success', 6000);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

// ── Boot ────────────────────────────────────────────────────────────────
checkForInvitation();
init();
