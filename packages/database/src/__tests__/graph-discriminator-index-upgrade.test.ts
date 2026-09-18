import { describe, it, expect, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  AGENT_DB_COLUMN_PATCHES,
  GRAPH_EDGES_CREATE_SQL,
  GRAPH_INDEXES_SQL,
  GRAPH_NODE_ALIASES_CREATE_SQL
} from '../agent-schema-compat'
import { ensureKnowledgeSchema } from '../knowledge-schema.shared'

const OLD_GRAPH_NODES_SQL = `
  CREATE TABLE IF NOT EXISTS graph_nodes (
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
`

const OLD_GRAPH_LIVE_NAME_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS graph_nodes_vault_type_name_live
  ON graph_nodes(vault_id, node_type, name_normalized)
  WHERE deleted_at IS NULL AND node_type != 'entry'
`

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

const OLD_NOTEBOOK_LIVE_NAME_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_nb_graph_nodes_live_name
  ON notebook_graph_nodes(vault_id, notebook_id, node_type, name_normalized)
  WHERE deleted_at IS NULL AND node_type != 'source'
`

async function insertLivePerson(opts: {
  client: Client
  table: 'graph_nodes' | 'notebook_graph_nodes'
  id: string
  discriminator: string
  notebookId?: string
}): Promise<void> {
  if (opts.table === 'graph_nodes') {
    await opts.client.execute({
      sql: `INSERT INTO graph_nodes (
        id, vault_id, node_type, name, name_normalized, discriminator, aliases, summary, props_json,
        mention_count, origin, shard_month, review_status, created_at, updated_at
      ) VALUES (?, 'vault-a', 'person', '张三', '张三', ?, '[]', '', '{}', 1, 'ai', '2026-09', 'approved', 1, 1)`,
      args: [opts.id, opts.discriminator]
    })
    return
  }
  await opts.client.execute({
    sql: `INSERT INTO notebook_graph_nodes (
      id, vault_id, notebook_id, node_type, name, name_normalized, discriminator, aliases, summary, props_json,
      mention_count, origin, shard_month, review_status, created_at, updated_at
    ) VALUES (?, 'vault-a', ?, 'person', '张三', '张三', ?, '[]', '', '{}', 1, 'ai', '2026-09', 'approved', 1, 1)`,
    args: [opts.id, opts.notebookId ?? 'nb1', opts.discriminator]
  })
}

describe('graph discriminator unique-index upgrade', () => {
  let client: Client
  let tempDir: string

  afterEach(async () => {
    client?.close()
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('should accept two same-name people after upgrading an old live-name unique index', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-graph-disc-upg-'))
    client = createClient({ url: `file:${path.join(tempDir, 'agent.db')}` })
    await client.execute(OLD_GRAPH_NODES_SQL)
    await client.execute(GRAPH_NODE_ALIASES_CREATE_SQL)
    await client.execute(GRAPH_EDGES_CREATE_SQL)
    await client.execute(OLD_GRAPH_LIVE_NAME_INDEX_SQL)

    const patch = AGENT_DB_COLUMN_PATCHES.find(
      (item) => item.table === 'graph_nodes' && item.column === 'discriminator'
    )
    expect(patch).toBeDefined()
    await client.execute(patch!.ddl)
    for (const ddl of GRAPH_INDEXES_SQL) {
      await client.execute(ddl)
    }

    await insertLivePerson({ client, table: 'graph_nodes', id: 'n-bare', discriminator: '' })
    await insertLivePerson({ client, table: 'graph_nodes', id: 'n-split', discriminator: '同事' })
    const rows = await client.execute('SELECT id FROM graph_nodes ORDER BY id')
    expect(rows.rows.map((row) => String((row as { id?: unknown }).id ?? ''))).toEqual([
      'n-bare',
      'n-split'
    ])
  })

  it('should accept two same-name notebook people after upgrading an old live-name unique index', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-nb-graph-disc-upg-'))
    client = createClient({ url: `file:${path.join(tempDir, 'knowledge.db')}` })
    await client.execute(OLD_NOTEBOOK_GRAPH_NODES_SQL)
    await client.execute(OLD_NOTEBOOK_LIVE_NAME_INDEX_SQL)
    await ensureKnowledgeSchema(client, '[NotebookGraphDiscUpgrade]')

    await insertLivePerson({
      client,
      table: 'notebook_graph_nodes',
      id: 'n-bare',
      discriminator: ''
    })
    await insertLivePerson({
      client,
      table: 'notebook_graph_nodes',
      id: 'n-split',
      discriminator: '同事'
    })
    const rows = await client.execute('SELECT id FROM notebook_graph_nodes ORDER BY id')
    expect(rows.rows.map((row) => String((row as { id?: unknown }).id ?? ''))).toEqual([
      'n-bare',
      'n-split'
    ])
  })
})
