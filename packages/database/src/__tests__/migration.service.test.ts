import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { MigrationService } from '../migration.service';
import { DatabaseConnectionManager } from '../connection.manager';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('MigrationService', () => {
  let dbManager: DatabaseConnectionManager;
  let tempDir: string;
  let service: MigrationService;
  let dbPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-migration-test-'));
    dbPath = path.join(tempDir, 'agent.db');
    
    dbManager = new DatabaseConnectionManager();
    const dbClient = await dbManager.connect(dbPath);
    
    service = new MigrationService(
      dbManager.getDb(), 
      (dbManager as any)._sqliteDb, 
      path.join(tempDir, 'dummy')
    );
    
    vi.spyOn(service as any, 'executeMigration').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await dbManager.disconnect();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
    vi.clearAllMocks();
  });

  describe('Global Operations', () => {
    it('runMigrations should call sub-pipelines successfully', async () => {
      // Spy on the sub method
      const customSpy = vi.spyOn(service as any, '_ensureCompressionSnapshotsCompatibility').mockResolvedValue(undefined);
      
      // We will mock readMigrationJournal to return empty to avoid throwing
      vi.spyOn(service as any, 'readMigrationJournal').mockResolvedValue({ version: '7', dialect: 'sqlite', entries: [] });

      await expect(service.runMigrations()).resolves.not.toThrow();
    });
  });

  describe('Legacy Snapshot UUID Convert Test', () => {
    it('_ensureCompressionSnapshotsCompatibility should safely handle existing float/integer ID conversion', async () => {
      const db = dbManager.getDb();
      
      // Setup a legacy table manually using SQLite raw pragmas
      await db.run(sql`
        CREATE TABLE compression_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at INTEGER,
            updated_at INTEGER,
            session_id INTEGER,
            summary_text TEXT,
            covered_up_to_message_id INTEGER,
            message_count INTEGER,
            token_count INTEGER
        );
      `);

      // Insert some legacy data
      await db.run(sql`
        INSERT INTO compression_snapshots (id, session_id, summary_text, covered_up_to_message_id, message_count, created_at)
        VALUES 
           (1, 123456, 'Summary 1', 999, 10, 1775486374),
           (2, 654321, 'Summary 2', 888, 20, 1775486375);
      `);

      // Manually trigger the migration pipeline
      // We restore the original method to actually test it
      vi.spyOn(service as any, '_ensureCompressionSnapshotsCompatibility').mockRestore();
      await (service as any)._ensureCompressionSnapshotsCompatibility();

      // Ensure the table values are now UUID format generated
      const records = await db.all(sql`SELECT * FROM compression_snapshots`);
      
      expect(records).toHaveLength(2);
      
      const snap1 = records.find(r => (r as any).id === 1) as any;
      expect(typeof snap1.session_id).toBe('string');
      expect(snap1.session_id).toBe('123456'); // The integer is preserved strictly as a text representation
      expect(typeof snap1.covered_up_to_message_id).toBe('string');
      expect(snap1.covered_up_to_message_id).toBe('999');
    });

    it('processCustomMigrations should not affect already valid TEXT layout', async () => {
       const db = dbManager.getDb();
       await db.run(sql`
        CREATE TABLE compression_snapshots (
            id TEXT PRIMARY KEY,
            session_id TEXT, -- Modern schema
            covered_up_to_message_id TEXT
        );
      `);

      const fakeUuid = 'bdf20a16-6512-40db-9494-0cfb3fbc957c';
      await db.run(sql`
        INSERT INTO compression_snapshots (id, session_id, covered_up_to_message_id)
        VALUES ('modern-snap', ${fakeUuid}, ${fakeUuid});
      `);

      await (service as any)._ensureCompressionSnapshotsCompatibility();

      const records = await db.all(sql`SELECT * FROM compression_snapshots`);
      expect(records).toHaveLength(1);
      const snap = records[0] as any;
      expect(snap.session_id).toBe(fakeUuid);
    });
  });
});
