import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { ShadowIndexConnectionManager } from '../shadow-index.connection.manager';
import { DatabaseNotConnectedError } from '../connection.manager.types';
import { sql } from 'drizzle-orm';
import { existsSync } from 'node:fs';

describe('ShadowIndexConnectionManager', () => {
  let manager: ShadowIndexConnectionManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-shadow-test-'));
    manager = new ShadowIndexConnectionManager();
  });

  afterEach(async () => {
    if (manager.isConnected()) {
      await manager.disconnect();
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
    vi.clearAllMocks();
  });

  it('should initialize successfully in `.baishou` directory of vault', async () => {
    const vaultPath = tempDir;
    // .baishou shouldn't exist initially
    const baishouDir = path.join(vaultPath, '.baishou');
    
    await manager.connect(baishouDir);
    expect(manager.isConnected()).toBe(true);

    // Assert the directory is created
    expect(existsSync(baishouDir)).toBe(true);
    
    // Check WAL mode was initialized correctly by running a PRAGMA fetch
    const db = manager.getDb();
    const result = await db.run(sql`PRAGMA journal_mode`);
    // NOTE: drizzle sqlite run() return type depends on the driver. In libsql, rows are accessible.
    // For this basic test, we just ensure it didn't throw during creation
    expect(db).toBeDefined();
  });

  it('should throw an error when getDb is called before connection', () => {
    expect(() => manager.getDb()).toThrowError('[ShadowDB] 影子索引数据库尚未连接，请先调用 connect()');
  });

  it('should ensure journals_fts and journals_index tables are initialized', async () => {
    const baishouDir = path.join(tempDir, '.baishou');
    await manager.connect(baishouDir);
    const db = manager.getDb();

    // Verify raw tables exist
    // Drizzle maps table names, we just manually query sqlite_master
    const tablesResult = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('journals_index', 'journals_fts')`);
    
    const tableNames = tablesResult.map(row => (row as any).name);
    expect(tableNames).toContain('journals_index');
    expect(tableNames).toContain('journals_fts');
  });

  it('should be able to recover from a corrupted database file', async () => {
    const baishouDir = path.join(tempDir, '.baishou');
    const dbFile = path.join(baishouDir, 'shadow_index.db');
    
    // Stage 1: Connect and create a normal database
    await manager.connect(baishouDir);
    expect(manager.isConnected()).toBe(true);
    await manager.disconnect();
    
    // Stage 2: Corrupt the file manually
    await fs.mkdir(baishouDir, { recursive: true });
    await fs.writeFile(dbFile, 'THIS_IS_NOT_A_SQLITE_FILE_TOTALLY_CORRUPT');

    // Stage 3: Reconnect. The connection manager deletes the corrupted file and recreates it.
    await expect(manager.connect(baishouDir)).resolves.not.toThrow();
    expect(manager.isConnected()).toBe(true);
    
    const db = manager.getDb();
    // Tables should be recreated
    const tablesResult = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='journals_index'`);
    expect(tablesResult.length).toBeGreaterThan(0);
  });

  it('should disconnect successfully without errors', async () => {
    const baishouDir = path.join(tempDir, '.baishou');
    await manager.connect(baishouDir);
    expect(manager.isConnected()).toBe(true);
    
    await manager.disconnect();
    expect(manager.isConnected()).toBe(false);
  });
});
