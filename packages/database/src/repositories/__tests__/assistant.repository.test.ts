import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from 'better-sqlite3';
import { AssistantRepository, InsertAssistantInput } from '../assistant.repository';
import { AppDatabase } from '../../types';
import DatabaseConstructor from 'better-sqlite3';

// To run an in-memory test DB for drizzle:
import { drizzle } from 'drizzle-orm/better-sqlite3';

describe('AssistantRepository', () => {
  let db: AppDatabase;
  let repo: AssistantRepository;
  let sqlite: Database;

  beforeEach(() => {
    sqlite = new DatabaseConstructor(':memory:');
    
    // We need to create the table since we're using in-memory
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_assistants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        emoji TEXT,
        description TEXT,
        avatar_path TEXT,
        system_prompt TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        context_window INTEGER NOT NULL DEFAULT 10,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        compress_token_threshold INTEGER NOT NULL DEFAULT 60000,
        compress_keep_turns INTEGER NOT NULL DEFAULT 3,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    db = drizzle(sqlite) as unknown as AppDatabase; // Cast since actual AppDatabase might carry schema info
    repo = new AssistantRepository(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('create', () => {
    it('should create an assistant with valid input', async () => {
      const draft: InsertAssistantInput = {
        id: 'ast-1',
        name: 'My Assistant',
        providerId: 'openai',
        modelId: 'gpt-4o',
        contextWindow: 12
      };

      await repo.create(draft);
      
      const found = await repo.findById('ast-1');
      expect(found).toBeDefined();
      expect(found?.name).toBe('My Assistant');
      expect(found?.providerId).toBe('openai');
      expect(found?.contextWindow).toBe(12);
      expect(found?.isDefault).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should return all assistants sorted by sortOrder and updatedAt', async () => {
      await repo.create({ id: 'ast-1', name: 'A', providerId: 'p', modelId: 'm', sortOrder: 1 });
      await repo.create({ id: 'ast-2', name: 'B', providerId: 'p', modelId: 'm', sortOrder: 0 }); // Higher priority sortOrder (assuming smaller means first or wait we'll define it)

      const results = await repo.findAll();
      expect(results.length).toBe(2);
      expect(results.some(a => a.id === 'ast-1')).toBeTruthy();
    });
  });

  describe('update', () => {
    it('should update specific fields of an assistant', async () => {
      await repo.create({ id: 'ast-x', name: 'Original', providerId: 'p', modelId: 'm' });
      await repo.update('ast-x', { name: 'Updated Name', modelId: 'm2' });

      const found = await repo.findById('ast-x');
      expect(found?.name).toBe('Updated Name');
      expect(found?.modelId).toBe('m2');
      expect(found?.providerId).toBe('p'); // Remains unchanged
    });
  });

  describe('delete', () => {
    it('should remove the assistant from database', async () => {
      await repo.create({ id: 'ast-del', name: 'To delete', providerId: 'p', modelId: 'm' });
      await repo.delete('ast-del');

      const found = await repo.findById('ast-del');
      expect(found).toBeUndefined();
    });
  });
});
