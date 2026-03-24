require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./src/models/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/partners', require('./src/routes/partners'));
app.use('/api/clients', require('./src/routes/clients'));
app.use('/api/modules', require('./src/routes/modules'));

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════════════╗`);
    console.log(`  ║   CYNEA AI Engineering Intelligence Platform  ║`);
    console.log(`  ║   Running on http://localhost:${PORT}             ║`);
    console.log(`  ╠══════════════════════════════════════════════╣`);
    console.log(`  ║   Demo Partner: partner@demo.com / demo1234  ║`);
    console.log(`  ║   Demo Client:  client@demo.com  / demo1234  ║`);
    console.log(`  ╚══════════════════════════════════════════════╝\n`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
