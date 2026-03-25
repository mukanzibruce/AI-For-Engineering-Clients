module.exports = async (req, res) => {
  try {
    // Step 1: Try loading the database
    const { initDatabase, getDb } = require('../src/models/database');
    await initDatabase();
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as c FROM ai_modules').get();

    // Step 2: Try loading Express app
    const app = require('./index');

    res.status(200).json({
      db_ok: true,
      modules: count.c,
      app_type: typeof app,
      app_keys: Object.keys(app || {}),
    });
  } catch (e) {
    res.status(500).json({
      error: e.message,
      stack: e.stack.split('\n').slice(0, 10),
    });
  }
};
