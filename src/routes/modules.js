const express = require('express');
const { getDb } = require('../models/database');

const router = express.Router();

// GET /api/modules
router.get('/', (req, res) => {
  const db = getDb();
  const modules = db.prepare('SELECT * FROM ai_modules WHERE is_active = 1 ORDER BY category, name').all();
  const categories = [...new Set(modules.map(m => m.category))];
  res.json({ modules, categories });
});

// GET /api/modules/:slug
router.get('/:slug', (req, res) => {
  const db = getDb();
  const mod = db.prepare('SELECT * FROM ai_modules WHERE slug = ?').get(req.params.slug);
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  res.json(mod);
});

module.exports = router;
