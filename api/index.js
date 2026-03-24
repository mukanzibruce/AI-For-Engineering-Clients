const express = require('express');
const cors = require('cors');
const path = require('path');

// Set DB path for Vercel (writable /tmp) before loading database
process.env.DB_PATH = '/tmp/cynea.db';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('../src/routes/auth'));
app.use('/api/partners', require('../src/routes/partners'));
app.use('/api/clients', require('../src/routes/clients'));
app.use('/api/modules', require('../src/routes/modules'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', platform: 'Cynea AI Engineering Intelligence' });
});

module.exports = app;
