module.exports = async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    // Check what files we can see
    const info = {
      cwd: process.cwd(),
      dirname: __dirname,
      nodeVersion: process.version,
    };

    // Check WASM candidates
    const candidates = [
      path.join(__dirname, 'sql-wasm.wasm'),
      path.join(__dirname, '../api/sql-wasm.wasm'),
      path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm'),
      path.resolve('api/sql-wasm.wasm'),
      path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'),
    ];

    info.wasm_candidates = candidates.map(p => ({
      path: p,
      exists: fs.existsSync(p),
    }));

    // Try listing __dirname
    try {
      info.dirname_files = fs.readdirSync(__dirname);
    } catch (e) {
      info.dirname_files_error = e.message;
    }

    // Try to load sql.js
    try {
      const sqlJsPath = require.resolve('sql.js');
      info.sqljs_path = sqlJsPath;
      info.sqljs_dir = fs.readdirSync(path.dirname(sqlJsPath)).filter(f => f.includes('wasm'));
    } catch (e) {
      info.sqljs_error = e.message;
    }

    res.status(200).json(info);
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
};
