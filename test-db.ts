import { initNodeDatabase, installDatabaseSchema } from './packages/database/src/drivers/node-sqlite.driver';
import * as path from 'path';

async function main() {
  try {
    const dbPath = path.join(__dirname, 'test.db');
    console.log('init DB at', dbPath);
    const db = initNodeDatabase(dbPath);
    
    // override migrationDir manually because we are running from root
    const { MigrationService } = await import('./packages/database/src/migration.service');
    const internalDb = db as any;
    const client = internalDb.session?.client;
    const migrationDir = path.join(__dirname, 'apps/desktop/resources/database/drizzle');
    
    const migrationService = new MigrationService(db, client, migrationDir);
    await migrationService.runMigrations();
    
    console.log('Success!');
  } catch (e) {
    console.error('FATAL', e);
  }
}

main();
