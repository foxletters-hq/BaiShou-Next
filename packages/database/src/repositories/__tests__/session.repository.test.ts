import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { SessionRepository } from '../session.repository';
import { AppDatabase } from '../../types';

describe('SessionRepository', () => {
  let db: AppDatabase;
  let repo: SessionRepository;
  let sqlite: Database;

  beforeEach(() => {
    sqlite = new DatabaseConstructor(':memory:');
    
    // Setup tables needed for SessionRepo tests
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        vault_name TEXT NOT NULL,
        assistant_id TEXT,
        system_prompt TEXT,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        total_input_tokens INTEGER NOT NULL DEFAULT 0,
        total_output_tokens INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        is_summary INTEGER NOT NULL DEFAULT 0,
        order_index INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS agent_parts (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    db = drizzle(sqlite) as unknown as AppDatabase;
    repo = new SessionRepository(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('findAllSessions', () => {
    it('should return all sessions sorted by isPinned and updatedAt', async () => {
      await repo.upsertSession({ id: 's1', vaultName: 'v', providerId: 'p', modelId: 'm' });
      await repo.upsertSession({ id: 's2', vaultName: 'v', providerId: 'p', modelId: 'm' });
      
      // Pin s1
      await repo.togglePin('s1', true);
      
      const results = await repo.findAllSessions();
      expect(results.length).toBe(2);
      expect(results[0]?.id).toBe('s1'); // pinned goes first
    });
  });

  describe('deleteSessions', () => {
    it('should delete multiple sessions at once', async () => {
      await repo.upsertSession({ id: 's1', vaultName: 'v', providerId: 'p', modelId: 'm' });
      await repo.upsertSession({ id: 's2', vaultName: 'v', providerId: 'p', modelId: 'm' });
      await repo.upsertSession({ id: 's3', vaultName: 'v', providerId: 'p', modelId: 'm' });
      
      await repo.deleteSessions(['s1', 's2']);
      
      const results = await repo.findAllSessions();
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('s3');
    });
  });

  describe('togglePin', () => {
    it('should toggle pin state correctly', async () => {
      await repo.upsertSession({ id: 'sp', vaultName: 'v', providerId: 'p', modelId: 'm' });
      
      await repo.togglePin('sp', true);
      const pinned = await repo.findAllSessions();
      expect(pinned[0]?.isPinned).toBe(true);
      
      await repo.togglePin('sp', false);
      const unpinned = await repo.findAllSessions();
      expect(unpinned[0]?.isPinned).toBe(false);
    });
  });
});
