const express = require('express');
const cors = require('cors');
const { initDatabase } = require('../src/models/database');

const app = express();
app.use(cors());
app.use(express.json());

// Database init middleware — ensures DB is ready before handling requests
let dbReady = false;
let dbInitPromise = null;

app.use(async (req, res, next) => {
  if (!dbReady) {
    if (!dbInitPromise) {
      process.env.DB_PATH = '/tmp/cynea.db';
      dbInitPromise = initDatabase();
    }
    try {
      await dbInitPromise;
      dbReady = true;
    } catch (err) {
      return res.status(500).json({ error: 'Database initialization failed', detail: err.message });
    }
  }
  next();
});

// Routes
app.use('/api/auth', require('../src/routes/auth'));
app.use('/api/partners', require('../src/routes/partners'));
app.use('/api/clients', require('../src/routes/clients'));
app.use('/api/modules', require('../src/routes/modules'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', platform: 'Cynea AI Engineering Intelligence', db: dbReady });
});

module.exports = app;
