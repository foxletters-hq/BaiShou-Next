import { describe, it, expect, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { ensureKnowledgeSchema, KNOWLEDGE_SCHEMA_VERSION } from '../knowledge-schema.shared'
import {
  isAndroidExternalSharedStoragePath,
  resolveExpoKnowledgeJournalMode
} from '../expo-knowledge-journal-mode.util'

describe('ensureKnowledgeSchema fast path & mobile journal mode', () => {
  let client: Client
  let tempDir: string

  afterEach(async () => {
    client?.close()
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('should skip redundant DDL, index drop/rebuild, and soft-delete purges when schema is already up to date', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-knowledge-fastpath-'))
    client = createClient({ url: `file:${path.join(tempDir, 'knowledge.db')}` })

    await ensureKnowledgeSchema(client, '[FastPathTest]')

    const executedStatements: string[] = []
    const recordingClient = {
      execute: async (arg: string | { sql: string; args?: unknown[] }) => {
        const sql = typeof arg === 'string' ? arg : arg.sql
        executedStatements.push(sql)
        return client.execute(arg as never)
      }
    }

    await ensureKnowledgeSchema(recordingClient, '[FastPathTest]')

    expect(executedStatements).toHaveLength(2)
    expect(executedStatements[0]).toContain('PRAGMA user_version')
    expect(executedStatements[1]).toContain('sqlite_master')
    expect(
      executedStatements.some((s) => /DROP\s+INDEX|DELETE\s+FROM|CREATE\s+TABLE/i.test(s))
    ).toBe(false)
  })

  it('should fall back to full schema creation when user_version is current but a core table is missing', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-knowledge-missing-'))
    client = createClient({ url: `file:${path.join(tempDir, 'knowledge.db')}` })
    await client.execute(`PRAGMA user_version = ${KNOWLEDGE_SCHEMA_VERSION}`)

    await ensureKnowledgeSchema(client, '[MissingTableTest]')

    const tables = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('notebooks', 'knowledge_chunks', 'notebook_graph_nodes')`
    )
    expect(tables.rows).toHaveLength(3)
  })

  it('should select TRUNCATE journal mode for Android external shared storage paths and WAL for app sandbox paths', () => {
    expect(isAndroidExternalSharedStoragePath('/storage/emulated/124/0312/knowledge.db')).toBe(true)
    expect(
      isAndroidExternalSharedStoragePath('/storage/emulated/0/BaiShou_Root/knowledge.db')
    ).toBe(true)
    expect(isAndroidExternalSharedStoragePath('file:///sdcard/BaiShou/knowledge.db')).toBe(true)
    expect(resolveExpoKnowledgeJournalMode('/storage/emulated/124/0312/knowledge.db')).toBe(
      'TRUNCATE'
    )

    expect(
      isAndroidExternalSharedStoragePath('/data/user/124/com.baishou.baishou/files/knowledge.db')
    ).toBe(false)
    expect(
      resolveExpoKnowledgeJournalMode('/data/user/124/com.baishou.baishou/files/knowledge.db')
    ).toBe('WAL')
  })
})
