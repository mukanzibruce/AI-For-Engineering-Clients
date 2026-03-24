const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDb } = require('../models/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { runAnalysis } = require('../services/aiEngine');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('client'));

// GET /api/clients/dashboard
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.user.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const partner = db.prepare('SELECT company_name, domain FROM partners WHERE id = ?').get(client.partner_id);

  const recentQueries = db.prepare(`SELECT q.*, m.name as module_name, m.category, m.icon
    FROM queries q JOIN ai_modules m ON q.module_id = m.id
    WHERE q.client_id = ? ORDER BY q.created_at DESC LIMIT 15`).all(req.user.id);

  const moduleCounts = db.prepare(`SELECT m.name, m.slug, COUNT(q.id) as uses
    FROM queries q JOIN ai_modules m ON q.module_id = m.id
    WHERE q.client_id = ? GROUP BY m.id ORDER BY uses DESC`).all(req.user.id);

  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC LIMIT 10'
  ).all('client', req.user.id);

  res.json({
    client: {
      id: client.id, company_name: client.company_name, contact_name: client.contact_name,
      email: client.email, industry: client.industry, subscription_tier: client.subscription_tier,
      subscription_status: client.subscription_status,
      monthly_queries: client.monthly_queries, query_limit: client.query_limit,
    },
    partner: partner || {},
    recent_queries: recentQueries,
    module_usage: moduleCounts,
    notifications,
  });
});

// GET /api/clients/modules
router.get('/modules', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT subscription_tier FROM clients WHERE id = ?').get(req.user.id);
  const tierRank = { standard: 1, professional: 2, enterprise: 3 };
  const rank = tierRank[client.subscription_tier] || 1;

  const modules = db.prepare('SELECT * FROM ai_modules WHERE is_active = 1').all();
  const available = modules.map(m => ({
    ...m,
    accessible: tierRank[m.tier_required] <= rank,
  }));

  res.json({ modules: available, current_tier: client.subscription_tier });
});

// POST /api/clients/query
router.post('/query', (req, res) => {
  const { module_slug, input_data } = req.body;
  if (!module_slug) return res.status(400).json({ error: 'module_slug required' });

  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.user.id);
  if (client.subscription_status !== 'active') {
    return res.status(403).json({ error: 'Subscription is not active' });
  }
  if (client.monthly_queries >= client.query_limit) {
    return res.status(429).json({ error: 'Monthly query limit reached. Contact your partner to upgrade.' });
  }

  const mod = db.prepare('SELECT * FROM ai_modules WHERE slug = ?').get(module_slug);
  if (!mod) return res.status(404).json({ error: 'Module not found' });

  const tierRank = { standard: 1, professional: 2, enterprise: 3 };
  if (tierRank[mod.tier_required] > tierRank[client.subscription_tier]) {
    return res.status(403).json({ error: `This module requires ${mod.tier_required} tier or above` });
  }

  const { result, processingTime } = runAnalysis(module_slug, input_data || '{}');

  const queryId = uuidv4();
  db.prepare(`INSERT INTO queries (id, client_id, module_id, input_data, result_data, status, processing_time_ms)
    VALUES (?, ?, ?, ?, ?, 'completed', ?)`).run(
    queryId, req.user.id, mod.id, JSON.stringify(input_data || {}), JSON.stringify(result), processingTime
  );

  db.prepare('UPDATE clients SET monthly_queries = monthly_queries + 1 WHERE id = ?').run(req.user.id);
  saveDb();

  res.json({
    query_id: queryId,
    module: mod.name,
    category: mod.category,
    status: 'completed',
    processing_time_ms: processingTime,
    result,
    usage: { used: client.monthly_queries + 1, limit: client.query_limit },
  });
});

// GET /api/clients/queries
router.get('/queries', (req, res) => {
  const db = getDb();
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as c FROM queries WHERE client_id = ?').get(req.user.id).c;
  const queries = db.prepare(`SELECT q.*, m.name as module_name, m.category, m.icon
    FROM queries q JOIN ai_modules m ON q.module_id = m.id
    WHERE q.client_id = ?
    ORDER BY q.created_at DESC LIMIT ? OFFSET ?`).all(req.user.id, +limit, +offset);

  res.json({ queries, total, page: +page, pages: Math.ceil(total / limit) });
});

// GET /api/clients/queries/:id
router.get('/queries/:id', (req, res) => {
  const db = getDb();
  const query = db.prepare(`SELECT q.*, m.name as module_name, m.category, m.slug as module_slug
    FROM queries q JOIN ai_modules m ON q.module_id = m.id
    WHERE q.id = ? AND q.client_id = ?`).get(req.params.id, req.user.id);
  if (!query) return res.status(404).json({ error: 'Query not found' });

  query.input_data = JSON.parse(query.input_data || '{}');
  query.result_data = JSON.parse(query.result_data || '{}');
  res.json(query);
});

module.exports = router;
