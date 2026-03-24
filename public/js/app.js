/* ═══════════════════════════════════════════════════════════════════════════
   CYNEA.AI — Frontend Application
   ═══════════════════════════════════════════════════════════════════════════ */

const API = '';
let token = localStorage.getItem('cynea_token');
let currentUser = JSON.parse(localStorage.getItem('cynea_user') || 'null');
let partnerData = null;
let clientData = null;
let allModules = [];

// ── API Helper ──────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
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
  const errEl = document.getElementById('login-error');

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('cynea_token', token);
    localStorage.setItem('cynea_user', JSON.stringify(currentUser));
    closeLogin();

    if (currentUser.role === 'partner') {
      await loadPartnerDashboard();
    } else {
      await loadClientDashboard();
    }
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
  localStorage.removeItem('cynea_token');
  localStorage.removeItem('cynea_user');
  showPage('landing-page');
}

// ── Init ────────────────────────────────────────────────────────────────

async function init() {
  await loadPublicModules();

  if (token && currentUser) {
    try {
      if (currentUser.role === 'partner') {
        await loadPartnerDashboard();
      } else {
        await loadClientDashboard();
      }
    } catch {
      logout();
    }
  }
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

// ═══════════════════════════════════════════════════════════════════════════
//  PARTNER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

async function loadPartnerDashboard() {
  showPage('partner-dashboard');
  document.getElementById('partner-name').textContent = currentUser.company_name;

  try {
    partnerData = await api('/api/partners/dashboard');
    const unread = partnerData.notifications.filter(n => !n.is_read).length;
    document.getElementById('partner-notif-count').textContent = unread;
    showPartnerSection('overview');
  } catch (err) {
    console.error(err);
  }
}

function showPartnerSection(section) {
  // Update nav
  document.querySelectorAll('#partner-dashboard .nav-item').forEach(n => n.classList.remove('active'));
  event?.target?.classList.add('active');

  const titles = {
    overview: 'Dashboard Overview', clients: 'Client Management',
    analytics: 'Analytics & Insights', onboard: 'Onboard New Client',
    'modules-list': 'AI Modules',
  };
  document.getElementById('partner-page-title').textContent = titles[section] || 'Dashboard';
  const el = document.getElementById('partner-content');

  if (section === 'overview') renderPartnerOverview(el);
  else if (section === 'clients') renderPartnerClients(el);
  else if (section === 'analytics') renderPartnerAnalytics(el);
  else if (section === 'onboard') renderPartnerOnboard(el);
  else if (section === 'modules-list') renderModulesListView(el);
}

function renderPartnerOverview(el) {
  const s = partnerData.stats;
  const pct = s.total_clients > 0 ? Math.round((s.active_clients / s.total_clients) * 100) : 0;

  el.innerHTML = `
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
        ${partnerData.recent_queries.length === 0 ? '<p style="color:var(--text-muted)">No queries yet</p>' : `
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

    <div class="card">
      <div class="card-header"><h2>Notifications</h2></div>
      <div class="card-body">
        ${partnerData.notifications.map(n => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center">
            <div style="width:8px;height:8px;border-radius:50%;background:${n.is_read ? 'var(--text-muted)' : 'var(--primary)'};flex-shrink:0"></div>
            <div><strong style="font-size:13px">${n.title}</strong><p style="font-size:12px;color:var(--text-muted)">${n.message || ''}</p></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderPartnerClients(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>All Clients (${partnerData.clients.length})</h2>
        <button class="btn btn-primary btn-sm" onclick="showPartnerSection('onboard')"><i class="fas fa-plus"></i> Add Client</button>
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
                  <button class="btn btn-ghost btn-sm" onclick="upgradeClient('${c.id}','${c.subscription_tier}')"><i class="fas fa-arrow-up"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function upgradeClient(clientId, currentTier) {
  const tiers = ['standard', 'professional', 'enterprise'];
  const idx = tiers.indexOf(currentTier);
  if (idx >= tiers.length - 1) { alert('Already on the highest tier'); return; }
  const newTier = tiers[idx + 1];
  if (!confirm(`Upgrade client to ${newTier}?`)) return;
  try {
    await api(`/api/partners/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify({ subscription_tier: newTier }),
    });
    await loadPartnerDashboard();
  } catch (err) { alert(err.message); }
}

async function renderPartnerAnalytics(el) {
  try {
    const analytics = await api('/api/partners/analytics');

    const maxCount = Math.max(...analytics.module_usage.map(m => m.query_count), 1);

    el.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>AI Module Usage</h2></div>
        <div class="card-body">
          ${analytics.module_usage.length === 0 ? '<p style="color:var(--text-muted)">No data yet</p>' : `
          <div class="chart-bars" style="margin-bottom:32px">
            ${analytics.module_usage.map(m => `
              <div class="chart-bar" style="height:${Math.max(10, (m.query_count / maxCount) * 100)}%">
                <span class="chart-bar-value">${m.query_count}</span>
                <span class="chart-bar-label">${m.name.split(' ')[0]}</span>
              </div>
            `).join('')}
          </div>`}
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
    el.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
}

function renderPartnerOnboard(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h2>Onboard New Client</h2></div>
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
              <input type="password" id="ob-password" required placeholder="Minimum 6 characters">
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
    // Refresh dashboard data
    partnerData = await api('/api/partners/dashboard');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

function renderModulesListView(el) {
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

  try {
    clientData = await api('/api/clients/dashboard');
    const unread = clientData.notifications.filter(n => !n.is_read).length;
    document.getElementById('client-notif-count').textContent = unread;

    const modData = await api('/api/clients/modules');
    clientData.modules = modData.modules;
    clientData.current_tier = modData.current_tier;

    showClientSection('overview');
  } catch (err) {
    console.error(err);
  }
}

function showClientSection(section) {
  document.querySelectorAll('#client-dashboard .nav-item').forEach(n => n.classList.remove('active'));
  event?.target?.classList.add('active');

  const titles = {
    overview: 'Dashboard Overview', 'ai-modules': 'AI Modules',
    analysis: 'Run AI Analysis', history: 'Query History',
  };
  document.getElementById('client-page-title').textContent = titles[section] || 'Dashboard';
  const el = document.getElementById('client-content');

  if (section === 'overview') renderClientOverview(el);
  else if (section === 'ai-modules') renderClientModules(el);
  else if (section === 'analysis') renderAnalysisForm(el);
  else if (section === 'history') renderQueryHistory(el);
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
          ${clientData.recent_queries.length === 0 ? '<p style="color:var(--text-muted)">No analyses run yet. Click "New" to get started.</p>' : `
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
          ${clientData.module_usage.length === 0 ? '<p style="color:var(--text-muted)">No usage data yet</p>' : `
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
    // Update usage
    clientData.client.monthly_queries = result.usage.used;
  } catch (err) {
    container.innerHTML = `<div class="analysis-result"><p style="color:var(--danger)"><i class="fas fa-exclamation-circle"></i> ${err.message}</p></div>`;
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
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;color:var(--text-muted)">Query ID: ${data.query_id}</span>
        <span style="font-size:12px;color:var(--text-muted)">Usage: ${data.usage.used} / ${data.usage.limit}</span>
      </div>
    </div>
  `;
}

async function renderQueryHistory(el) {
  try {
    const data = await api('/api/clients/queries?limit=25');
    el.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>Query History (${data.total} total)</h2></div>
        <div class="card-body">
          ${data.queries.length === 0 ? '<p style="color:var(--text-muted)">No queries yet</p>' : `
          <table class="data-table">
            <thead><tr><th>Module</th><th>Category</th><th>Status</th><th>Processing Time</th><th>Date</th><th></th></tr></thead>
            <tbody>
              ${data.queries.map(q => `
                <tr>
                  <td><i class="${getIconClass(q.icon)}" style="margin-right:8px;color:var(--accent)"></i>${q.module_name}</td>
                  <td>${q.category}</td>
                  <td><span class="status-badge ${q.status}">${q.status}</span></td>
                  <td>${q.processing_time_ms}ms</td>
                  <td>${new Date(q.created_at).toLocaleString()}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="viewQueryResult('${q.id}')"><i class="fas fa-eye"></i></button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>`}
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
  }
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
    alert(err.message);
  }
}

// ── Boot ────────────────────────────────────────────────────────────────
init();
