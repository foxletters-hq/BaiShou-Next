import { describe, expect, it, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { ensureKnowledgeSchema } from '../knowledge-schema.shared'

const OLD_NOTEBOOK_GRAPH_NODES_SQL = `
  CREATE TABLE IF NOT EXISTS notebook_graph_nodes (
    id              TEXT PRIMARY KEY,
    vault_id        TEXT NOT NULL,
    notebook_id     TEXT NOT NULL,
    node_type       TEXT NOT NULL,
    name            TEXT NOT NULL,
    name_normalized TEXT NOT NULL DEFAULT '',
    aliases         TEXT NOT NULL DEFAULT '[]',
    summary         TEXT NOT NULL DEFAULT '',
    props_json      TEXT NOT NULL DEFAULT '{}',
    mention_count   INTEGER NOT NULL DEFAULT 0,
    first_seen_at   INTEGER,
    last_seen_at    INTEGER,
    origin          TEXT NOT NULL DEFAULT 'ai',
    shard_month     TEXT NOT NULL DEFAULT '',
    review_status   TEXT NOT NULL DEFAULT 'approved',
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER
  )
`

describe('notebook_graph_nodes embedding columns', () => {
  let client: Client
  let tempDir: string

  afterEach(async () => {
    client?.close()
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('should 补齐三列与 embed_state 索引 when 旧表没有向量列', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-nb-graph-embed-'))
    client = createClient({ url: `file:${path.join(tempDir, 'knowledge.db')}` })
    await client.execute(OLD_NOTEBOOK_GRAPH_NODES_SQL)
    await ensureKnowledgeSchema(client, '[NotebookGraphEmbedTest]')

    const cols = await client.execute('PRAGMA table_info(notebook_graph_nodes)')
    const names = cols.rows.map((row) => String((row as { name?: unknown }).name ?? ''))
    expect(names).toEqual(expect.arrayContaining(['embedding', 'dimension', 'model_id']))

    const indexes = await client.execute(
      `SELECT name, sql FROM sqlite_master WHERE type='index' AND name='idx_nb_graph_nodes_embed_state'`
    )
    expect(indexes.rows).toHaveLength(1)
    expect(String((indexes.rows[0] as { sql?: string }).sql ?? '')).toMatch(/notebook_id/i)
    expect(String((indexes.rows[0] as { sql?: string }).sql ?? '')).toMatch(/deleted_at IS NULL/i)
  })
})
