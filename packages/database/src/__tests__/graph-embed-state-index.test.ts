import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient, Client } from '@libsql/client'
import {
  GRAPH_EDGES_CREATE_SQL,
  GRAPH_INDEXES_SQL,
  GRAPH_NODE_ALIASES_CREATE_SQL,
  GRAPH_NODES_CREATE_SQL
} from '../agent-schema-compat'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

describe('graph_nodes_vault_embed_state', () => {
  let db: Client
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-graph-embed-idx-'))
    db = createClient({ url: `file:${path.join(tempDir, 'graph.db')}` })
    await db.execute(GRAPH_NODES_CREATE_SQL)
    await db.execute(GRAPH_NODE_ALIASES_CREATE_SQL)
    await db.execute(GRAPH_EDGES_CREATE_SQL)
    for (const ddl of GRAPH_INDEXES_SQL) {
      await db.execute(ddl)
    }
  })

  afterEach(async () => {
    db.close()
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('creates the partial embed-state index', async () => {
    const indexes = await db.execute(
      `SELECT name, sql FROM sqlite_master WHERE type='index' AND name='graph_nodes_vault_embed_state'`
    )
    expect(indexes.rows).toHaveLength(1)
    expect(String((indexes.rows[0] as { sql?: string }).sql ?? '')).toMatch(/deleted_at IS NULL/i)
  })

  it('does not count soft-deleted nodes as missing embeddings', async () => {
    await db.execute({
      sql: `
        INSERT INTO graph_nodes (
          id, vault_id, node_type, name, name_normalized, aliases, summary, props_json,
          embedding, dimension, model_id, mention_count, origin, shard_month, review_status,
          created_at, updated_at, deleted_at
        ) VALUES
          ('live-missing', 'vault-a', 'person', '张三', '张三', '[]', '', '{}',
           NULL, NULL, '', 1, 'ai', '2026-09', 'approved', 1, 1, NULL),
          ('live-ok', 'vault-a', 'person', '李四', '李四', '[]', '', '{}',
           X'00', 8, 'm1', 1, 'ai', '2026-09', 'approved', 1, 1, NULL),
          ('deleted-missing', 'vault-a', 'person', '王五', '王五', '[]', '', '{}',
           NULL, NULL, '', 1, 'ai', '2026-09', 'approved', 1, 1, 99)
      `,
      args: []
    })

    const result = await db.execute({
      sql: `
        SELECT COUNT(*) AS c FROM graph_nodes
        WHERE vault_id = ? AND deleted_at IS NULL
          AND (dimension IS NULL OR dimension = 0 OR model_id != ?)
      `,
      args: ['vault-a', 'm1']
    })
    expect(Number((result.rows[0] as { c?: unknown }).c ?? 0)).toBe(1)
  })
})
