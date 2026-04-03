const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const path = require('path');

const dbPath = path.join(require('os').homedir(), 'AppData', 'Roaming', '@baishou', 'desktop', 'baishou_next_agent.db');
const client = createClient({ url: 'file:' + dbPath });
const db = drizzle(client);

// Inspect internal structure to find the client
console.log('db keys:', Object.keys(db));
console.log('db._ keys:', db._ ? Object.keys(db._) : 'no _');
console.log('db.session keys:', db.session ? Object.keys(db.session) : 'no session');
if (db.session) {
  console.log('db.session.client:', typeof db.session.client);
}

// Try alternate paths
const fields = ['_', 'session', 'driver', 'dialect'];
for (const f of fields) {
  if (db[f]) {
    console.log(`db.${f} keys:`, Object.keys(db[f]));
    for (const k of Object.keys(db[f])) {
      if (db[f][k] && typeof db[f][k] === 'object' && db[f][k].execute) {
        console.log(`  FOUND client-like object at db.${f}.${k}`);
      }
    }
  }
}
