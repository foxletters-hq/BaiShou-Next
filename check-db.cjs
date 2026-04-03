const { createClient } = require('@libsql/client');
const path = require('path');
const dbPath = path.join(require('os').homedir(), 'AppData', 'Roaming', '@baishou', 'desktop', 'baishou_next_agent.db');
console.log('DB Path:', dbPath);
const db = createClient({ url: 'file:' + dbPath });
db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .then(r => {
    console.log('Tables found:', r.rows.length);
    r.rows.forEach(row => console.log(' -', row.name));
  })
  .catch(console.error);
