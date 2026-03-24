const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDb } = require('../models/database');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('partner'));

// GET /api/partners/dashboard
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const partnerId = req.user.id;
  const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(partnerId);
  const clients = db.prepare('SELECT * FROM clients WHERE partner_id = ?').all(partnerId);
  const clientIds = clients.map(c => c.id);

  let totalQueries = 0;
  let recentQueries = [];
  if (clientIds.length > 0) {
    const placeholders = clientIds.map(() => '?').join(',');
    totalQueries = db.prepare(`SELECT COUNT(*) as c FROM queries WHERE client_id IN (${placeholders})`).get(...clientIds).c;
    recentQueries = db.prepare(`SELECT q.*, c.company_name as client_name, m.name as module_name
      FROM queries q
      JOIN clients c ON q.client_id = c.id
      JOIN ai_modules m ON q.module_id = m.id
      WHERE q.client_id IN (${placeholders})
      ORDER BY q.created_at DESC LIMIT 10`).all(...clientIds);
  }

  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC LIMIT 10'
  ).all('partner', partnerId);

  const mrr = clients.reduce((sum, c) => {
    const prices = { standard: 299, professional: 599, enterprise: 1299 };
    return sum + (prices[c.subscription_tier] || 299);
  }, 0);

  res.json({
    partner: { id: partner.id, company_name: partner.company_name, domain: partner.domain, plan: partner.plan },
    stats: {
      total_clients: clients.length,
      active_clients: clients.filter(c => c.subscription_status === 'active').length,
      total_queries: totalQueries,
      mrr,
    },
    clients: clients.map(c => ({
      id: c.id, company_name: c.company_name, contact_name: c.contact_name,
      email: c.email, industry: c.industry, subscription_tier: c.subscription_tier,
      subscription_status: c.subscription_status, monthly_queries: c.monthly_queries,
      query_limit: c.query_limit, created_at: c.created_at,
    })),
    recent_queries: recentQueries,
    notifications,
  });
});

// POST /api/partners/clients
router.post('/clients', (req, res) => {
  const { company_name, contact_name, email, password, industry, subscription_tier } = req.body;
  if (!company_name || !contact_name || !email || !password) {
    return res.status(400).json({ error: 'Required fields: company_name, contact_name, email, password' });
  }
  try {
    const db = getDb();
    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    const tier = subscription_tier || 'standard';
    const limits = { standard: 250, professional: 500, enterprise: 2000 };
    db.prepare(`INSERT INTO clients (id, partner_id, company_name, contact_name, email, password_hash, industry, subscription_tier, query_limit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.user.id, company_name, contact_name, email, hash, industry || null, tier, limits[tier] || 250);

    db.prepare(`INSERT INTO notifications (id, target_type, target_id, title, message) VALUES (?, ?, ?, ?, ?)`)
      .run(uuidv4(), 'partner', req.user.id, 'Client Onboarded', `${company_name} added on ${tier} tier.`);
    saveDb();

    res.status(201).json({ id, company_name, contact_name, email, subscription_tier: tier });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Client email already exists' });
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PATCH /api/partners/clients/:id
router.patch('/clients/:id', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND partner_id = ?').get(req.params.id, req.user.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const { subscription_tier, subscription_status, query_limit } = req.body;
  if (subscription_tier) db.prepare('UPDATE clients SET subscription_tier = ? WHERE id = ?').run(subscription_tier, client.id);
  if (subscription_status) db.prepare('UPDATE clients SET subscription_status = ? WHERE id = ?').run(subscription_status, client.id);
  if (query_limit) db.prepare('UPDATE clients SET query_limit = ? WHERE id = ?').run(query_limit, client.id);
  saveDb();

  res.json({ success: true });
});

// GET /api/partners/analytics
router.get('/analytics', (req, res) => {
  const db = getDb();
  const clients = db.prepare('SELECT id FROM clients WHERE partner_id = ?').all(req.user.id);
  if (clients.length === 0) return res.json({ module_usage: [], daily_queries: [], tier_distribution: [] });

  const ids = clients.map(c => c.id);
  const ph = ids.map(() => '?').join(',');

  const moduleUsage = db.prepare(`SELECT m.name, m.category, COUNT(q.id) as query_count
    FROM queries q JOIN ai_modules m ON q.module_id = m.id
    WHERE q.client_id IN (${ph}) GROUP BY m.id ORDER BY query_count DESC`).all(...ids);

  const tierDist = db.prepare(`SELECT subscription_tier as tier, COUNT(*) as count
    FROM clients WHERE partner_id = ? GROUP BY subscription_tier`).all(req.user.id);

  res.json({ module_usage: moduleUsage, tier_distribution: tierDist });
});

module.exports = router;
