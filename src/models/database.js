const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/cynea.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
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
  );

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
  );

  CREATE TABLE IF NOT EXISTS ai_modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    tier_required TEXT NOT NULL DEFAULT 'standard',
    is_active INTEGER DEFAULT 1
  );

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
  );

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
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Seed AI Modules ─────────────────────────────────────────────────────────

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

const insertModule = db.prepare(`
  INSERT OR IGNORE INTO ai_modules (id, name, slug, category, description, icon, tier_required)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const m of modules) {
  insertModule.run(uuidv4(), m.name, m.slug, m.category, m.description, m.icon, m.tier);
}

// ── Seed Demo Data ──────────────────────────────────────────────────────────

const partnerExists = db.prepare('SELECT COUNT(*) as c FROM partners').get();
if (partnerExists.c === 0) {
  const demoPartnerId = uuidv4();
  const demoClientId = uuidv4();
  const hash = bcrypt.hashSync('demo1234', 10);

  db.prepare(`INSERT INTO partners (id, company_name, email, password_hash, domain, plan)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    demoPartnerId, 'Apex Engineering Group', 'partner@demo.com', hash, 'civil-structural', 'enterprise'
  );

  db.prepare(`INSERT INTO clients (id, partner_id, company_name, contact_name, email, password_hash, industry, subscription_tier, monthly_queries, query_limit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    demoClientId, demoPartnerId, 'BuildRight Construction', 'Sarah Chen', 'client@demo.com', hash, 'Construction', 'professional', 127, 500
  );

  // Seed some queries
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

  const insertQuery = db.prepare(`INSERT INTO queries (id, client_id, module_id, input_data, result_data, status, processing_time_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`);

  sampleQueries.forEach((q, i) => {
    if (modMap[q.module]) {
      insertQuery.run(uuidv4(), demoClientId, modMap[q.module], q.input, q.result, q.status, q.time, `-${(sampleQueries.length - i)} hours`);
    }
  });

  // Notifications
  const insertNotif = db.prepare(`INSERT INTO notifications (id, target_type, target_id, title, message) VALUES (?, ?, ?, ?, ?)`);
  insertNotif.run(uuidv4(), 'partner', demoPartnerId, 'New Client Onboarded', 'BuildRight Construction has been successfully onboarded to the Professional tier.');
  insertNotif.run(uuidv4(), 'client', demoClientId, 'Query Limit Update', 'Your monthly query limit has been increased to 500.');
}

module.exports = db;
