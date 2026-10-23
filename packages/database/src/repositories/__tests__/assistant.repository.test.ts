import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS,
  DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
  DEFAULT_ASSISTANT_CONTEXT_WINDOW
} from '@baishou/shared'
import { Database } from 'better-sqlite3'
import { AssistantRepository, InsertAssistantInput } from '../assistant.repository'
import { AppDatabase } from '../../types'
import DatabaseConstructor from 'better-sqlite3'

import { drizzle } from 'drizzle-orm/better-sqlite3'

const TEST_VAULT = 'vlt_assistant_repo_test'

describe('AssistantRepository', () => {
  let db: AppDatabase
  let repo: AssistantRepository
  let sqlite: Database

  beforeEach(() => {
    sqlite = new DatabaseConstructor(':memory:')

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_assistants (
        id TEXT NOT NULL,
        vault_id TEXT NOT NULL,
        name TEXT NOT NULL,
        emoji TEXT,
        description TEXT,
        avatar_path TEXT,
        system_prompt TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        context_window INTEGER NOT NULL DEFAULT ${DEFAULT_ASSISTANT_CONTEXT_WINDOW},
        provider_id TEXT,
        model_id TEXT,
        compress_token_threshold INTEGER NOT NULL DEFAULT ${DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD},
        compress_keep_turns INTEGER NOT NULL DEFAULT ${DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS},
        compress_model_context_window INTEGER,
        compress_preserve_recent_tokens INTEGER,
        compress_system_prompt TEXT,
        custom_system_prompt TEXT,
        assistant_kind TEXT NOT NULL DEFAULT 'companion',
        emoji_group_id TEXT,
        emoji_enabled INTEGER NOT NULL DEFAULT 0,
        emoji_group_ids TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (vault_id, id)
      );
    `)

    db = drizzle(sqlite) as unknown as AppDatabase
    repo = new AssistantRepository(db, () => TEST_VAULT)
  })

  afterEach(() => {
    sqlite.close()
  })

  describe('create', () => {
    it('should create an assistant with valid input', async () => {
      const draft: InsertAssistantInput = {
        id: 'ast-1',
        name: 'My Assistant',
        providerId: 'openai',
        modelId: 'gpt-4o',
        contextWindow: 12
      }

      await repo.create(draft)

      const found = await repo.findById('ast-1')
      expect(found).toBeDefined()
      expect(found?.name).toBe('My Assistant')
      expect(found?.providerId).toBe('openai')
      expect(found?.contextWindow).toBe(12)
      expect(found?.isDefault).toBe(false)
      expect((found as any)?.vaultId).toBe(TEST_VAULT)
    })

    it('applies memory defaults when optional fields are omitted', async () => {
      await repo.create({
        id: 'ast-defaults',
        name: 'Defaults',
        providerId: 'openai',
        modelId: 'gpt-4o'
      })

      const found = await repo.findById('ast-defaults')
      expect(found?.compressTokenThreshold).toBe(DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD)
      expect(found?.compressKeepTurns).toBe(DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS)
      expect(found?.contextWindow).toBe(DEFAULT_ASSISTANT_CONTEXT_WINDOW)
    })
  })

  describe('findAll', () => {
    it('scopes by vault_id', async () => {
      await repo.create({
        id: 'a1',
        name: 'A',
        vaultId: TEST_VAULT,
        providerId: 'x',
        modelId: 'y'
      })
      await repo.create({
        id: 'a1',
        name: 'B',
        vaultId: 'vlt_other',
        providerId: 'x',
        modelId: 'y'
      })

      const all = await repo.findAll(TEST_VAULT)
      expect(all).toHaveLength(1)
      expect(all[0]?.name).toBe('A')
    })
  })
})
