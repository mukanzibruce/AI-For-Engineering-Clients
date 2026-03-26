const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const { getDb, saveDb } = require('../models/database');
const { generateToken, verifyTokenAllowExpired, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password, role, rememberMe } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const db = getDb();
  const table = role === 'partner' ? 'partners' : 'clients';
  const user = db.prepare(`SELECT * FROM ${table} WHERE email = ?`).get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: role || 'client',
    company: user.company_name,
  }, !!rememberMe);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: role || 'client',
      company_name: user.company_name,
      plan: user.plan || user.subscription_tier,
    },
  });
});

// POST /api/auth/register-partner
router.post('/register-partner', (req, res) => {
  const { company_name, email, password, domain } = req.body;
  if (!company_name || !email || !password || !domain) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const db = getDb();
    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`INSERT INTO partners (id, company_name, email, password_hash, domain) VALUES (?, ?, ?, ?, ?)`)
      .run(id, company_name, email, hash, domain);
    saveDb();
    const token = generateToken({ id, email, role: 'partner', company: company_name });
    res.status(201).json({ token, user: { id, email, role: 'partner', company_name } });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/register-client (via partner invitation token)
router.post('/register-client', (req, res) => {
  const { company_name, contact_name, email, password, industry, partner_id, invitation_code } = req.body;
  if (!company_name || !contact_name || !email || !password || !partner_id) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const db = getDb();
    // Verify partner exists
    const partner = db.prepare('SELECT id, company_name FROM partners WHERE id = ?').get(partner_id);
    if (!partner) return res.status(404).json({ error: 'Invalid partner' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`INSERT INTO clients (id, partner_id, company_name, contact_name, email, password_hash, industry, subscription_tier, query_limit)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'standard', 250)`).run(id, partner_id, company_name, contact_name, email, hash, industry || null);

    // Notify partner
    db.prepare(`INSERT INTO notifications (id, target_type, target_id, title, message) VALUES (?, ?, ?, ?, ?)`)
      .run(uuidv4(), 'partner', partner_id, 'New Client Registered', `${company_name} has self-registered via invitation link.`);
    saveDb();

    const token = generateToken({ id, email, role: 'client', company: company_name });
    res.status(201).json({ token, user: { id, email, role: 'client', company_name } });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token required' });
  }
  const oldToken = header.split(' ')[1];
  const decoded = verifyTokenAllowExpired(oldToken);
  if (!decoded) {
    return res.status(401).json({ error: 'Token cannot be refreshed' });
  }

  const db = getDb();
  const table = decoded.role === 'partner' ? 'partners' : 'clients';
  const user = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(decoded.id);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const newToken = generateToken({
    id: user.id,
    email: user.email,
    role: decoded.role,
    company: user.company_name,
  });

  res.json({
    token: newToken,
    user: {
      id: user.id,
      email: user.email,
      role: decoded.role,
      company_name: user.company_name,
      plan: user.plan || user.subscription_tier,
    },
  });
});

// GET /api/auth/profile (protected)
router.get('/profile', authMiddleware, (req, res) => {
  const db = getDb();
  const table = req.user.role === 'partner' ? 'partners' : 'clients';
  const user = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const profile = {
    id: user.id,
    email: user.email,
    role: req.user.role,
    company_name: user.company_name,
    created_at: user.created_at,
  };

  if (req.user.role === 'partner') {
    profile.domain = user.domain;
    profile.plan = user.plan;
    profile.status = user.status;
  } else {
    profile.contact_name = user.contact_name;
    profile.industry = user.industry;
    profile.subscription_tier = user.subscription_tier;
    profile.subscription_status = user.subscription_status;
    profile.monthly_queries = user.monthly_queries;
    profile.query_limit = user.query_limit;
  }

  res.json(profile);
});

// PATCH /api/auth/profile (protected)
router.patch('/profile', authMiddleware, (req, res) => {
  const db = getDb();
  const { company_name, contact_name, domain, industry } = req.body;

  if (req.user.role === 'partner') {
    if (company_name) db.prepare('UPDATE partners SET company_name = ? WHERE id = ?').run(company_name, req.user.id);
    if (domain) db.prepare('UPDATE partners SET domain = ? WHERE id = ?').run(domain, req.user.id);
  } else {
    if (company_name) db.prepare('UPDATE clients SET company_name = ? WHERE id = ?').run(company_name, req.user.id);
    if (contact_name) db.prepare('UPDATE clients SET contact_name = ? WHERE id = ?').run(contact_name, req.user.id);
    if (industry) db.prepare('UPDATE clients SET industry = ? WHERE id = ?').run(industry, req.user.id);
  }
  saveDb();
  res.json({ success: true });
});

// POST /api/auth/change-password (protected)
router.post('/change-password', authMiddleware, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const db = getDb();
  const table = req.user.role === 'partner' ? 'partners' : 'clients';
  const user = db.prepare(`SELECT password_hash FROM ${table} WHERE id = ?`).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare(`UPDATE ${table} SET password_hash = ? WHERE id = ?`).run(hash, req.user.id);
  saveDb();
  res.json({ success: true });
});

module.exports = router;
