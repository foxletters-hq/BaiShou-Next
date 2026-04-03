const { initNodeDatabase, installDatabaseSchema } = require('./packages/database/src/drivers/node-sqlite.driver.ts');

async function test() {
  const dbPath = require('path').join(require('os').homedir(), 'AppData', 'Roaming', '@baishou', 'desktop', 'baishou_next_agent.db');
  console.log('dbPath', dbPath);
  const db = initNodeDatabase(dbPath);
  await installDatabaseSchema(db);
}
test().catch(console.error);
