import { expect, test, describe, beforeAll, afterAll } from 'vitest';
import { DatabaseConnectionManager } from '../../connection.manager';
import { SettingsRepository } from '../settings.repository';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';

describe('Database Storage Export / Import Simulator', () => {
  let connectionManager: DatabaseConnectionManager;
  let tempDir: string;
  let dbPath: string;

  beforeAll(async () => {
    tempDir = path.join(__dirname, '.test_tmp');
    if (fs.existsSync(tempDir)) {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }
    await fsp.mkdir(tempDir, { recursive: true });
    dbPath = path.join(tempDir, 'test_agent.db');

    connectionManager = new DatabaseConnectionManager();
    const db = await connectionManager.connect(dbPath);
    
    // Minimal schema init since installDatabaseSchema might be elsewhere
    // Wait, Drizzle might not auto-create tables without using push/migrate unless DDL is explicitly run
    // For pure storage copy testing, if the file exists and is copied, we can test file existence or basic KV inserts.
  });

    afterAll(async () => {
    await connectionManager.disconnect();
    try {
      if (fs.existsSync(tempDir)) {
        await fsp.rm(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore EBUSY on Windows
    }
  });

  test('It should persist db states, allow copying (export), and reload (import) properly', async () => {
    const db = connectionManager.getDb();
    
    // Let's create a raw table manually just to ensure the file receives bytes
    await (connectionManager as any)._sqliteDb.execute(`
      CREATE TABLE IF NOT EXISTS test_dump (
        id INTEGER PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    
    await (connectionManager as any)._sqliteDb.execute(`
      INSERT INTO test_dump (value) VALUES ('BaiShou-Next-Data')
    `);

    // Verify written
    const res1 = await (connectionManager as any)._sqliteDb.execute(`SELECT * FROM test_dump`);
    expect(res1.rows[0].value).toBe('BaiShou-Next-Data');

    // 1. Pre-Export: Disconnect to flush WAL and release locks (simulate safe backup)
    await connectionManager.disconnect();

    // 2. Export (Archive): Physical dump
    const archiveDbPath = path.join(tempDir, 'archive_backup.db');
    await fsp.copyFile(dbPath, archiveDbPath);

    // 3. Wipe original to simulate transferring to a new machine
    // (Bypass direct rm to avoid transient Windows file locking from libsql client)
    const newDbPath = path.join(tempDir, 'new_agent_imported.db');
    // 4. Import (Extract to a new location)
    await fsp.copyFile(archiveDbPath, newDbPath);
    expect(fs.existsSync(newDbPath)).toBe(true);

    // 5. Reconnect and verify data persists safely across the file system bridge
    await connectionManager.connect(newDbPath);
    
    const res2 = await (connectionManager as any)._sqliteDb.execute(`SELECT * FROM test_dump`);
    expect(res2.rows[0].value).toBe('BaiShou-Next-Data');
  });
});
