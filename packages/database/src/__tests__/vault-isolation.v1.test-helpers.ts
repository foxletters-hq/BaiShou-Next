import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { createClient, type Client } from '@libsql/client'
import { deriveLegacyVaultId } from '@baishou/shared'
import { SqliteHybridSearchRepository } from '../repositories/hybrid-search.repository'
import { createSqlExecutor } from '../sql-executor.factory'

export const VAULT_A = deriveLegacyVaultId('A')
export const VAULT_B = deriveLegacyVaultId('B')
export const VAULT_PERSONAL = deriveLegacyVaultId('Personal')
export const VAULT_WORK = deriveLegacyVaultId('Work')

export function vec(n: number): number[] {
  return [n, 0, 0]
}

/** 与生产 V2.2 表结构对齐的最小 schema。 */
export async function createSchema(db: Client): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      vault_id TEXT NOT NULL,
      assistant_id TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      provider_id TEXT NOT NULL DEFAULT 'x',
      model_id TEXT NOT NULL DEFAULT 'y',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS memory_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      embedding_id TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      vault_id TEXT,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      chunk_text TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      embedding BLOB NOT NULL,
      dimension INTEGER NOT NULL,
      model_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      source_created_at INTEGER
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT PRIMARY KEY NOT NULL,
      vault_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      name TEXT NOT NULL,
      name_normalized TEXT NOT NULL DEFAULT '',
      aliases TEXT NOT NULL DEFAULT '[]',
      summary TEXT NOT NULL DEFAULT '',
      props_json TEXT NOT NULL DEFAULT '{}',
      mention_count INTEGER NOT NULL DEFAULT 0,
      origin TEXT NOT NULL DEFAULT 'ai',
      shard_month TEXT NOT NULL DEFAULT '',
      review_status TEXT NOT NULL DEFAULT 'approved',
      model_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS graph_node_aliases (
      id TEXT PRIMARY KEY NOT NULL,
      vault_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      alias_normalized TEXT NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS graph_edges (
      id TEXT PRIMARY KEY NOT NULL,
      vault_id TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      edge_type TEXT NOT NULL,
      props_json TEXT NOT NULL DEFAULT '{}',
      is_current INTEGER NOT NULL DEFAULT 1,
      source_kind TEXT NOT NULL DEFAULT 'diary',
      source_excerpt TEXT NOT NULL DEFAULT '',
      confidence INTEGER NOT NULL DEFAULT 100,
      origin TEXT NOT NULL DEFAULT 'ai',
      review_status TEXT NOT NULL DEFAULT 'approved',
      shard_month TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS diary_embed_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_id TEXT NOT NULL,
      diary_id INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_id TEXT NOT NULL,
      type TEXT NOT NULL,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      content TEXT NOT NULL,
      source_ids TEXT,
      generated_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER
    )
  `)
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS summaries_vault_id_type_start_date_end_date_unique
    ON summaries (vault_id, type, start_date, end_date)
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agent_assistants (
      id TEXT NOT NULL,
      vault_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      context_window INTEGER NOT NULL DEFAULT -1,
      compress_token_threshold INTEGER NOT NULL DEFAULT 150000,
      compress_keep_turns INTEGER NOT NULL DEFAULT 3,
      assistant_kind TEXT NOT NULL DEFAULT 'companion',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (vault_id, id)
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS compression_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      summary_text TEXT NOT NULL DEFAULT '',
      covered_up_to_message_id TEXT NOT NULL DEFAULT '',
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0
    )
  `)
}

export type VaultIsolationFixture = {
  db: Client
  repo: SqliteHybridSearchRepository
  exec: ReturnType<typeof createSqlExecutor>
  tempDir: string
}

/** 每条用例独立临时库，避免隔离断言互相污染。 */
export async function createVaultIsolationFixture(): Promise<VaultIsolationFixture> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-vault-iso-'))
  const dbPath = path.join(tempDir, 'test.db')
  const db = createClient({ url: `file:${dbPath}` })
  await createSchema(db)
  return {
    db,
    repo: new SqliteHybridSearchRepository(db),
    exec: createSqlExecutor(db),
    tempDir
  }
}

export async function disposeVaultIsolationFixture(
  fixture: VaultIsolationFixture | undefined
): Promise<void> {
  if (!fixture) return
  fixture.db.close()
  await fs.rm(fixture.tempDir, { recursive: true, force: true }).catch(() => undefined)
}

/** 回填迁移测试用的最小 SQL 执行器。 */
export function createSqlExec(db: Client) {
  return async (sql: string, args: Array<string | number | null> = []) => {
    const res = await db.execute({ sql, args })
    return { rows: res.rows as Array<Record<string, unknown>>, rowsAffected: res.rowsAffected }
  }
}
