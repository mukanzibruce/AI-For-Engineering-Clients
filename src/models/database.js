const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

// Locate the WASM file for sql.js (required for Vercel serverless)
// Multiple candidate paths for different environments:
//   1. Bundled copy next to the serverless entry point (api/)
//   2. node_modules (standard location)
//   3. Relative to this file for local dev
const WASM_CANDIDATES = [
  path.join(__dirname, '../../api/sql-wasm.wasm'),
  path.resolve('api/sql-wasm.wasm'),
  path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm'),
  path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'),
];
const WASM_PATH = WASM_CANDIDATES.find(p => {
  try { return fs.existsSync(p); } catch { return false; }
});
if (!WASM_PATH) {
  throw new Error(
    'sql-wasm.wasm not found. Searched:\n' + WASM_CANDIDATES.join('\n')
  );
}

// ── Compatibility wrapper ───────────────────────────────────────────────
// sql.js returns rows as arrays; we wrap it to return objects like better-sqlite3

let _db = null;
let _initPromise = null;

function wrapDb(rawDb) {
  function rowsToObjects(stmt, params) {
    if (params && params.length) stmt.bind(params);
    const cols = stmt.getColumnNames();
    const rows = [];
    while (stmt.step()) {
      const vals = stmt.get();
      const obj = {};
      cols.forEach((c, i) => { obj[c] = vals[i]; });
      rows.push(obj);
    }
    stmt.free();
    return rows;
  }

  const wrapper = {
    prepare(sql) {
      return {
        run(...params) {
          rawDb.run(sql, params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
        },
        get(...params) {
          const stmt = rawDb.prepare(sql);
          if (params.length) stmt.bind(params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
          const result = stmt.step() ? (() => {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const obj = {};
            cols.forEach((c, i) => { obj[c] = vals[i]; });
            return obj;
          })() : undefined;
          stmt.free();
          return result;
        },
        all(...params) {
          const stmt = rawDb.prepare(sql);
          return rowsToObjects(stmt, params.length === 1 && Array.isArray(params[0]) ? params[0] : params);
        },
      };
    },
    exec(sql) {
      rawDb.run(sql);
    },
    pragma() {},
  };
  return wrapper;
}

// ── Initialize ──────────────────────────────────────────────────────────

async function initDatabase() {
  const wasmBinary = fs.readFileSync(WASM_PATH);
  const SQL = await initSqlJs({ wasmBinary });

  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/cynea.db');

  let rawDb;
  try {
    if (fs.existsSync(DB_PATH)) {
      const buf = fs.readFileSync(DB_PATH);
      rawDb = new SQL.Database(buf);
      const db = wrapDb(rawDb);
      // Check if tables exist
      const check = db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name='partners'").get();
      if (check && check.c > 0) {
        _db = db;
        _db._raw = rawDb;
        _db._path = DB_PATH;
        return _db;
      }
    }
  } catch (e) {
    // Fall through to create new
  }

  rawDb = new SQL.Database();
  const db = wrapDb(rawDb);

  // ── Schema ──────────────────────────────────────────────────────────
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      domain TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'professional',
      status TEXT NOT NULL DEFAULT 'active',
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      industry TEXT,
      subscription_tier TEXT NOT NULL DEFAULT 'standard',
      subscription_status TEXT NOT NULL DEFAULT 'active',
      monthly_queries INTEGER DEFAULT 0,
      query_limit INTEGER DEFAULT 500,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (partner_id) REFERENCES partners(id)
    )
  `);
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS ai_modules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      tier_required TEXT NOT NULL DEFAULT 'standard',
      is_active INTEGER DEFAULT 1
    )
  `);
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS queries (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      input_data TEXT,
      result_data TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      processing_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (module_id) REFERENCES ai_modules(id)
    )
  `);
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      module_id TEXT,
      analysis_status TEXT DEFAULT 'pending',
      analysis_result TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Seed AI Modules ─────────────────────────────────────────────────
  const modules = [
    { name: 'Structural Analysis AI', slug: 'structural-analysis', category: 'Civil & Structural', description: 'AI-powered structural load analysis, stress simulation, and safety factor calculations for beams, columns, foundations, and frames.', icon: 'building', tier: 'standard' },
    { name: 'Design Optimisation Engine', slug: 'design-optimisation', category: 'Mechanical', description: 'Generative design suggestions, topology optimisation, and material selection recommendations using AI-driven parametric analysis.', icon: 'cogs', tier: 'standard' },
    { name: 'Predictive Maintenance', slug: 'predictive-maintenance', category: 'Industrial', description: 'Predict equipment failures before they occur using vibration data, temperature trends, and operational patterns with machine learning models.', icon: 'heartbeat', tier: 'standard' },
    { name: 'Compliance & Standards Checker', slug: 'compliance-checker', category: 'Regulatory', description: 'Automated checking of engineering documents against ISO, ASME, Eurocode, BS, and OSHA standards with gap analysis reports.', icon: 'clipboard-check', tier: 'standard' },
    { name: 'Project Risk Analyser', slug: 'risk-analyser', category: 'Project Management', description: 'AI-driven risk identification, probability scoring, and mitigation strategy generation for engineering projects.', icon: 'exclamation-triangle', tier: 'standard' },
    { name: 'Quality Control Vision', slug: 'qc-vision', category: 'Manufacturing', description: 'Computer vision-powered defect detection, dimensional verification, and surface quality inspection for manufactured components.', icon: 'eye', tier: 'professional' },
    { name: 'Energy & Thermal Modelling', slug: 'energy-thermal', category: 'Electrical & Energy', description: 'AI thermal simulation, energy consumption forecasting, and efficiency optimisation for buildings and industrial processes.', icon: 'bolt', tier: 'professional' },
    { name: 'Document Intelligence', slug: 'document-intelligence', category: 'Cross-Discipline', description: 'Extract, classify, and analyse data from engineering drawings, specifications, P&IDs, and technical reports using NLP and vision AI.', icon: 'file-alt', tier: 'standard' },
    { name: 'Environmental Impact Modeller', slug: 'environmental-impact', category: 'Environmental', description: 'Carbon footprint estimation, lifecycle assessment, and environmental compliance modelling for engineering projects.', icon: 'leaf', tier: 'professional' },
    { name: 'Supply Chain Optimiser', slug: 'supply-chain', category: 'Operations', description: 'AI-optimised procurement, inventory forecasting, and supplier risk scoring for engineering material supply chains.', icon: 'truck', tier: 'enterprise' },
    { name: 'Piping & Flow Analysis', slug: 'piping-flow', category: 'Chemical & Process', description: 'AI-assisted pipe sizing, pressure drop calculations, fluid dynamics simulation, and P&ID validation.', icon: 'water', tier: 'professional' },
    { name: 'Geotechnical Intelligence', slug: 'geotechnical', category: 'Civil & Structural', description: 'Soil bearing capacity prediction, settlement analysis, and foundation design recommendations from borehole and survey data.', icon: 'mountain', tier: 'enterprise' },
  ];

  for (const m of modules) {
    rawDb.run(
      `INSERT OR IGNORE INTO ai_modules (id, name, slug, category, description, icon, tier_required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), m.name, m.slug, m.category, m.description, m.icon, m.tier]
    );
  }

  // ── Seed Demo Data ──────────────────────────────────────────────────
  const demoPartnerId = uuidv4();
  const demoClientId = uuidv4();
  const hash = bcrypt.hashSync('demo1234', 10);

  rawDb.run(
    `INSERT INTO partners (id, company_name, email, password_hash, domain, plan) VALUES (?, ?, ?, ?, ?, ?)`,
    [demoPartnerId, 'Apex Engineering Group', 'partner@demo.com', hash, 'civil-structural', 'enterprise']
  );

  rawDb.run(
    `INSERT INTO clients (id, partner_id, company_name, contact_name, email, password_hash, industry, subscription_tier, monthly_queries, query_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [demoClientId, demoPartnerId, 'BuildRight Construction', 'Sarah Chen', 'client@demo.com', hash, 'Construction', 'professional', 127, 500]
  );

  const mods = db.prepare('SELECT id, slug FROM ai_modules').all();
  const modMap = {};
  for (const m of mods) modMap[m.slug] = m.id;

  const sampleQueries = [
    { module: 'structural-analysis', input: '{"type":"beam","span":12,"load":45,"material":"steel_s355"}', result: '{"max_moment":810,"max_shear":270,"deflection":14.2,"safety_factor":2.8,"recommendation":"UB 457x191x67 adequate","status":"PASS"}', status: 'completed', time: 1240 },
    { module: 'compliance-checker', input: '{"standard":"eurocode_2","document":"foundation_design_rev3.pdf"}', result: '{"compliance_score":87,"gaps":3,"critical":1,"warnings":2,"details":"Clause 6.4.2 - punching shear check missing"}', status: 'completed', time: 3400 },
    { module: 'predictive-maintenance', input: '{"equipment":"crane_07","vibration_rms":4.2,"temp":78,"hours":12400}', result: '{"risk_score":0.72,"predicted_failure":"bearing","days_remaining":34,"confidence":0.89,"action":"Schedule replacement within 3 weeks"}', status: 'completed', time: 890 },
    { module: 'risk-analyser', input: '{"project":"Highway Bridge Retrofit","budget":2400000,"timeline_months":18}', result: '{"overall_risk":"MEDIUM","top_risks":[{"risk":"Ground condition uncertainty","probability":0.65,"impact":"HIGH"},{"risk":"Supply chain delays","probability":0.45,"impact":"MEDIUM"}],"mitigation_count":8}', status: 'completed', time: 2100 },
    { module: 'document-intelligence', input: '{"file":"steel_fabrication_dwg_set.pdf","pages":24}', result: '{"entities_extracted":142,"drawings_classified":24,"bom_items":67,"annotations":["Missing weld symbols on 3 connections","Dimension conflict on Sheet 12"]}', status: 'completed', time: 5600 },
  ];

  sampleQueries.forEach((q, i) => {
    if (modMap[q.module]) {
      rawDb.run(
        `INSERT INTO queries (id, client_id, module_id, input_data, result_data, status, processing_time_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
        [uuidv4(), demoClientId, modMap[q.module], q.input, q.result, q.status, q.time, `-${(sampleQueries.length - i)} hours`]
      );
    }
  });

  rawDb.run(`INSERT INTO notifications (id, target_type, target_id, title, message) VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), 'partner', demoPartnerId, 'New Client Onboarded', 'BuildRight Construction has been successfully onboarded to the Professional tier.']);
  rawDb.run(`INSERT INTO notifications (id, target_type, target_id, title, message) VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), 'client', demoClientId, 'Query Limit Update', 'Your monthly query limit has been increased to 500.']);

  // Save to disk
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = rawDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    // In serverless, /tmp write may fail silently — that's ok, DB is in memory
  }

  _db = db;
  _db._raw = rawDb;
  _db._path = DB_PATH;
  return _db;
}

// ── Sync initializer (for require-time compat) ──────────────────────────

function getDb() {
  if (_db) return _db;
  throw new Error('Database not initialized. Call await initDatabase() first.');
}

// Save periodically (after mutations)
function saveDb() {
  if (_db && _db._raw && _db._path) {
    try {
      const data = _db._raw.export();
      fs.writeFileSync(_db._path, Buffer.from(data));
    } catch (e) { /* serverless may not persist */ }
  }
}

module.exports = { initDatabase, getDb, saveDb };
