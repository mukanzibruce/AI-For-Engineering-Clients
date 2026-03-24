const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDb } = require('../models/database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password, role } = req.body;
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
  });

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

module.exports = router;
