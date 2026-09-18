import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { MigrationService } from '../migration.service'
import { DatabaseConnectionManager } from '../connection.manager'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

describe('MigrationService', () => {
  let dbManager: DatabaseConnectionManager
  let tempDir: string
  let service: MigrationService
  let dbPath: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-migration-test-'))
    dbPath = path.join(tempDir, 'agent.db')

    dbManager = new DatabaseConnectionManager()
    await dbManager.connect(dbPath)

    service = new MigrationService(
      dbManager.getDb(),
      (dbManager as any)._sqliteDb,
      path.join(tempDir, 'dummy')
    )

    vi.spyOn(service as any, 'executeMigration').mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await dbManager.disconnect()
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (e) {
      // ignore
    }
    vi.clearAllMocks()
  })

  describe('Global Operations', () => {
    it('runMigrations should call sub-pipelines successfully', async () => {
      // Spy on the sub method
      vi.spyOn(service as any, '_ensureCompressionSnapshotsCompatibility').mockResolvedValue(
        undefined
      )

      // We will mock readMigrationJournal to return empty to avoid throwing
      vi.spyOn(service as any, 'readMigrationJournal').mockResolvedValue({
        version: '7',
        dialect: 'sqlite',
        entries: []
      })

      await expect(service.runMigrations()).resolves.not.toThrow()
    })
  })

  describe('Legacy Snapshot UUID Convert Test', () => {
    it('_ensureCompressionSnapshotsCompatibility should safely handle existing float/integer ID conversion', async () => {
      const db = dbManager.getDb()

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
      `)

      // Insert some legacy data
      await db.run(sql`
        INSERT INTO compression_snapshots (id, session_id, summary_text, covered_up_to_message_id, message_count, created_at)
        VALUES 
           (1, 123456, 'Summary 1', 999, 10, 1775486374),
           (2, 654321, 'Summary 2', 888, 20, 1775486375);
      `)

      // Manually trigger the migration pipeline
      // We restore the original method to actually test it
      vi.spyOn(service as any, '_ensureCompressionSnapshotsCompatibility').mockRestore()
      await (service as any)._ensureCompressionSnapshotsCompatibility()

      // Ensure the table values are now UUID format generated
      const records = await db.all(sql`SELECT * FROM compression_snapshots`)

      expect(records).toHaveLength(2)

      const snap1 = records.find((r) => (r as any).id === 1) as any
      expect(typeof snap1.session_id).toBe('string')
      expect(snap1.session_id).toBe('123456') // The integer is preserved strictly as a text representation
      expect(typeof snap1.covered_up_to_message_id).toBe('string')
      expect(snap1.covered_up_to_message_id).toBe('999')
    })

    it('processCustomMigrations should not affect already valid TEXT layout', async () => {
      const db = dbManager.getDb()
      await db.run(sql`
        CREATE TABLE compression_snapshots (
            id TEXT PRIMARY KEY,
            session_id TEXT, -- Modern schema
            covered_up_to_message_id TEXT
        );
      `)

      const fakeUuid = 'bdf20a16-6512-40db-9494-0cfb3fbc957c'
      await db.run(sql`
        INSERT INTO compression_snapshots (id, session_id, covered_up_to_message_id)
        VALUES ('modern-snap', ${fakeUuid}, ${fakeUuid});
      `)

      await (service as any)._ensureCompressionSnapshotsCompatibility()

      const records = await db.all(sql`SELECT * FROM compression_snapshots`)
      expect(records).toHaveLength(1)
      const snap = records[0] as any
      expect(snap.session_id).toBe(fakeUuid)
    })
  })

  describe('Token usage column compatibility', () => {
    it('_ensureAgentSchemaColumns should add missing cache token columns', async () => {
      const db = dbManager.getDb()
      await db.run(sql`
        CREATE TABLE agent_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL DEFAULT '新对话',
          vault_id TEXT NOT NULL,
          assistant_id TEXT,
          is_pinned INTEGER NOT NULL DEFAULT 0,
          system_prompt TEXT,
          provider_id TEXT NOT NULL,
          model_id TEXT NOT NULL,
          total_input_tokens INTEGER NOT NULL DEFAULT 0,
          total_output_tokens INTEGER NOT NULL DEFAULT 0,
          total_cost_micros INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `)

      await (service as any)._ensureAgentSchemaColumns()

      const cols = await db.all(sql`PRAGMA table_info(agent_sessions)`)
      const names = cols.map((c: any) => c.name)
      expect(names).toContain('total_cache_read_input_tokens')
      expect(names).toContain('total_cache_write_input_tokens')
      expect(names).toContain('mounted_notebook_ids')
    })

    it('_ensureAgentSchemaColumns should add missing order_index on legacy agent_messages', async () => {
      const db = dbManager.getDb()
      await db.run(sql`
        CREATE TABLE agent_messages (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          is_summary INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
      `)
      await db.run(sql`
        INSERT INTO agent_messages (id, session_id, role, created_at)
        VALUES ('m1', 's1', 'user', 100),
               ('m2', 's1', 'assistant', 200);
      `)

      await (service as any)._ensureAgentSchemaColumns()
      await (service as any)._backfillAgentMessagesOrderIndex()

      const cols = await db.all(sql`PRAGMA table_info(agent_messages)`)
      const names = cols.map((c: any) => c.name)
      expect(names).toContain('order_index')

      const rows = await db.all(sql`
        SELECT id, order_index FROM agent_messages ORDER BY created_at
      `)
      expect(rows).toEqual([
        { id: 'm1', order_index: 0 },
        { id: 'm2', order_index: 1 }
      ])
    })

    it('_ensureAgentSchemaColumns should add missing message cache token columns', async () => {
      const db = dbManager.getDb()
      await db.run(sql`
        CREATE TABLE agent_messages (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          is_summary INTEGER NOT NULL DEFAULT 0,
          ask_id TEXT,
          provider_id TEXT,
          model_id TEXT,
          order_index INTEGER NOT NULL,
          input_tokens INTEGER,
          output_tokens INTEGER,
          cost_micros INTEGER,
          created_at INTEGER NOT NULL
        );
      `)

      await (service as any)._ensureAgentSchemaColumns()

      const cols = await db.all(sql`PRAGMA table_info(agent_messages)`)
      const names = cols.map((c: any) => c.name)
      expect(names).toContain('cache_read_input_tokens')
      expect(names).toContain('cache_write_input_tokens')
    })

    it('_ensureAgentSchemaColumns should add assistant_kind and compress columns', async () => {
      const db = dbManager.getDb()
      await db.run(sql`
        CREATE TABLE agent_assistants (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          emoji TEXT,
          description TEXT,
          avatar_path TEXT,
          system_prompt TEXT,
          is_default INTEGER NOT NULL DEFAULT 0,
          is_pinned INTEGER NOT NULL DEFAULT 0,
          context_window INTEGER NOT NULL DEFAULT 20,
          provider_id TEXT,
          model_id TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `)

      await (service as any)._ensureAgentSchemaColumns()

      const cols = await db.all(sql`PRAGMA table_info(agent_assistants)`)
      const names = cols.map((c: any) => c.name)
      expect(names).toContain('assistant_kind')
      expect(names).toContain('compress_token_threshold')
      expect(names).toContain('compress_keep_turns')
    })

    it('_ensureMemoryEmbeddingsTable should create missing vector table', async () => {
      await (service as any)._ensureMemoryEmbeddingsTable()

      const db = dbManager.getDb()
      const tables = await db.all(sql`
        SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'
      `)
      expect(tables).toHaveLength(1)
    })

    it('_retireDiaryEmbedJobsTable migrates leftover jobs into embed_ledger without file hashes then drops the table', async () => {
      const db = dbManager.getDb()
      await (service as any)._ensureEmbedLedgerTable()
      await db.run(sql`
        CREATE TABLE diary_embed_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          vault_id TEXT NOT NULL,
          diary_id INTEGER NOT NULL,
          content_hash TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          next_retry_at INTEGER,
          updated_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        )
      `)
      await db.run(sql`
        INSERT INTO diary_embed_jobs
          (vault_id, diary_id, content_hash, status, attempts, last_error, updated_at, created_at)
        VALUES
          ('vault-a', 12, 'file-md5-should-not-copy', 'pending', 2, 'old-error', 100, 100)
      `)
      await db.run(sql`
        INSERT INTO embed_ledger
          (vault_id, source_type, source_id, content_hash, chunk_count, model_id, dimension,
           status, attempts, last_error, embedded_at, updated_at)
        VALUES
          ('vault-a', 'diary', 'vault-a#99', 'already', 1, 'm', 8, 'embedded', 0, NULL, 1, 1)
      `)

      await (service as any)._retireDiaryEmbedJobsTable()
      await (service as any)._retireDiaryEmbedJobsTable()

      const jobs = await db.all(sql`
        SELECT name FROM sqlite_master WHERE type='table' AND name='diary_embed_jobs'
      `)
      expect(jobs).toHaveLength(0)

      const rows = (await db.all(sql`SELECT * FROM embed_ledger ORDER BY source_id`)) as Array<{
        source_id: string
        content_hash: string
      }>
      expect(rows).toHaveLength(2)
      const migrated = rows.find((row) => row.source_id === 'vault-a#12')
      expect(migrated).toMatchObject({
        vault_id: 'vault-a',
        source_type: 'diary',
        source_id: 'vault-a#12',
        content_hash: '',
        status: 'failed',
        attempts: 2
      })
      expect(String(migrated?.content_hash ?? '')).not.toBe('file-md5-should-not-copy')
    })

    it('_ensureEmbedLedgerTable should create table and indexes and stay idempotent', async () => {
      await (service as any)._ensureEmbedLedgerTable()
      await (service as any)._ensureEmbedLedgerTable()

      const db = dbManager.getDb()
      const tables = await db.all(sql`
        SELECT name FROM sqlite_master WHERE type='table' AND name='embed_ledger'
      `)
      expect(tables).toHaveLength(1)

      const indexes = await db.all(sql`
        SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='embed_ledger'
      `)
      const indexNames = indexes.map((row) => (row as { name: string }).name)
      expect(indexNames).toContain('embed_ledger_source_unique')
      expect(indexNames).toContain('embed_ledger_read_idx')
    })

    it('_ensureGraphTables should create graph_nodes_vault_embed_state index', async () => {
      await (service as any)._ensureGraphTables()
      await (service as any)._ensureGraphTables()

      const db = dbManager.getDb()
      const indexes = await db.all(sql`
        SELECT name FROM sqlite_master
        WHERE type='index' AND name='graph_nodes_vault_embed_state'
      `)
      expect(indexes).toHaveLength(1)
    })

    it('should accept two same-name people after upgrading an old live-name unique index', async () => {
      const db = dbManager.getDb()
      await db.run(sql`
        CREATE TABLE graph_nodes (
          id TEXT PRIMARY KEY NOT NULL,
          vault_id TEXT NOT NULL,
          node_type TEXT NOT NULL,
          name TEXT NOT NULL,
          name_normalized TEXT DEFAULT '' NOT NULL,
          aliases TEXT DEFAULT '[]' NOT NULL,
          summary TEXT DEFAULT '' NOT NULL,
          props_json TEXT DEFAULT '{}' NOT NULL,
          embedding BLOB,
          dimension INTEGER,
          model_id TEXT DEFAULT '' NOT NULL,
          mention_count INTEGER DEFAULT 0 NOT NULL,
          first_seen_at INTEGER,
          last_seen_at INTEGER,
          origin TEXT DEFAULT 'ai' NOT NULL,
          shard_month TEXT DEFAULT '' NOT NULL,
          review_status TEXT DEFAULT 'approved' NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        )
      `)
      await db.run(sql`
        CREATE UNIQUE INDEX graph_nodes_vault_type_name_live
        ON graph_nodes(vault_id, node_type, name_normalized)
        WHERE deleted_at IS NULL AND node_type != 'entry'
      `)

      await (service as any)._ensureGraphTables()
      await (service as any)._ensureAgentSchemaColumns()

      await db.run(sql`
        INSERT INTO graph_nodes (
          id, vault_id, node_type, name, name_normalized, discriminator, aliases, summary, props_json,
          mention_count, origin, shard_month, review_status, created_at, updated_at
        ) VALUES
          ('n-bare', 'vault-a', 'person', '张三', '张三', '', '[]', '', '{}', 1, 'ai', '2026-09', 'approved', 1, 1),
          ('n-split', 'vault-a', 'person', '张三', '张三', '同事', '[]', '', '{}', 1, 'ai', '2026-09', 'approved', 1, 1)
      `)
      const rows = await db.all(sql`SELECT id FROM graph_nodes ORDER BY id`)
      expect(rows.map((row) => (row as { id: string }).id)).toEqual(['n-bare', 'n-split'])
    })

    it('_ensureEmbedLedgerTable should upgrade a legacy db that only has memory_embeddings', async () => {
      const db = dbManager.getDb()
      await db.run(sql`
        CREATE TABLE memory_embeddings (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          embedding_id TEXT NOT NULL,
          source_type TEXT NOT NULL,
          source_id TEXT NOT NULL,
          group_id TEXT NOT NULL,
          vault_id TEXT,
          chunk_index INTEGER DEFAULT 0 NOT NULL,
          chunk_text TEXT NOT NULL,
          metadata_json TEXT DEFAULT '{}' NOT NULL,
          embedding BLOB NOT NULL,
          dimension INTEGER NOT NULL,
          model_id TEXT DEFAULT '' NOT NULL,
          created_at INTEGER NOT NULL,
          source_created_at INTEGER
        )
      `)

      await expect((service as any)._ensureEmbedLedgerTable()).resolves.not.toThrow()

      const tables = await db.all(sql`
        SELECT name FROM sqlite_master WHERE type='table' AND name='embed_ledger'
      `)
      expect(tables).toHaveLength(1)
    })

    it('_ensureSystemSettingsTable should create missing settings table on legacy agent db', async () => {
      const db = dbManager.getDb()
      await db.run(sql`
        CREATE TABLE agent_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL DEFAULT '新对话',
          vault_id TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          model_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `)

      await (service as any)._ensureSystemSettingsTable()

      const tables = await db.all(sql`
        SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'
      `)
      expect(tables).toHaveLength(1)
    })
  })
})
