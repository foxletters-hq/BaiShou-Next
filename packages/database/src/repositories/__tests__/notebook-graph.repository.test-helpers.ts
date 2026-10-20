import { describe } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import {
  NOTEBOOK_GRAPH_ALIASES_SQL,
  NOTEBOOK_GRAPH_EDGES_SQL,
  NOTEBOOK_GRAPH_INDEXES_SQL,
  NOTEBOOK_GRAPH_NODES_SQL
} from '../../knowledge-schema.shared'
import { NotebookGraphRepository } from '../notebook-graph.repository'

export type NotebookGraphLibsqlFixture = {
  client: Client
  repo: NotebookGraphRepository
}

/** libsql 内存库：建好 notebook_graph 三表与索引。 */
export async function createNotebookGraphLibsqlFixture(): Promise<NotebookGraphLibsqlFixture> {
  const client = createClient({ url: ':memory:' })
  await client.execute(NOTEBOOK_GRAPH_NODES_SQL)
  await client.execute(NOTEBOOK_GRAPH_ALIASES_SQL)
  await client.execute(NOTEBOOK_GRAPH_EDGES_SQL)
  for (const sql of NOTEBOOK_GRAPH_INDEXES_SQL) await client.execute(sql)
  return { client, repo: new NotebookGraphRepository(drizzle(client) as never) }
}

export function disposeNotebookGraphLibsqlFixture(
  fixture: NotebookGraphLibsqlFixture | undefined
): void {
  fixture?.client.close()
}

export function canOpenBetterSqlite3(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3')
    const db = new Database(':memory:')
    db.close()
    return true
  } catch {
    return false
  }
}

/** 桌面 knowledge 驱动依赖原生 better-sqlite3，缺失时整组跳过。 */
export const describeGraph = canOpenBetterSqlite3() ? describe : describe.skip

export type KnowledgeDbManager = {
  connect: (dir: string) => Promise<void>
  disconnect: () => void
  getDb: () => unknown
}

export type NotebookGraphDesktopFixture = {
  tempDir: string
  dbManager: KnowledgeDbManager
  repo: NotebookGraphRepository
}

export async function createNotebookGraphDesktopFixture(): Promise<NotebookGraphDesktopFixture> {
  const { KnowledgeConnectionManager } = await import('../../knowledge.connection.manager')
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-nb-graph-'))
  const dbManager = new KnowledgeConnectionManager()
  await dbManager.connect(tempDir)
  return {
    tempDir,
    dbManager,
    repo: new NotebookGraphRepository(dbManager.getDb() as never)
  }
}

export function disposeNotebookGraphDesktopFixture(
  fixture: NotebookGraphDesktopFixture | undefined
): void {
  fixture?.dbManager.disconnect()
}
