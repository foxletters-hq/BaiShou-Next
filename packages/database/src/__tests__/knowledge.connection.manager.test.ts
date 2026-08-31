import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { existsSync } from 'node:fs'

import { KnowledgeConnectionManager } from '../knowledge.connection.manager'
import { KNOWLEDGE_DB_FILENAME } from '../knowledge-schema.shared'
import { KnowledgeRepository } from '../repositories/knowledge.repository'
import { sql } from 'drizzle-orm'

function canOpenBetterSqlite3(): boolean {
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

const describeKnowledge = canOpenBetterSqlite3() ? describe : describe.skip

describeKnowledge('KnowledgeConnectionManager', () => {
  let manager: KnowledgeConnectionManager
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-knowledge-test-'))
    manager = new KnowledgeConnectionManager()
  })

  afterEach(() => {
    if (manager.isConnected()) manager.disconnect()
    return fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('建库成功且 vec_version() 可用', async () => {
    await manager.connect(tempDir)
    expect(manager.isConnected()).toBe(true)
    expect(existsSync(path.join(tempDir, KNOWLEDGE_DB_FILENAME))).toBe(true)

    const vec = manager.getVecVersion()
    expect(vec).toBeTruthy()

    const sqlite = manager.getSqlite()
    const row = sqlite.prepare('SELECT vec_version() AS v').get() as { v: string }
    expect(row.v).toBeTruthy()
    expect(row.v).toBe(vec)

    const db = manager.getDb()
    const tables = await db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('notebooks', 'knowledge_sources', 'knowledge_chunks', 'knowledge_ingest_jobs')`
    )
    const names = tables.map((r) => (r as { name: string }).name)
    expect(names).toEqual(
      expect.arrayContaining([
        'notebooks',
        'knowledge_sources',
        'knowledge_chunks',
        'knowledge_ingest_jobs'
      ])
    )

    const cols = sqlite.prepare('PRAGMA table_info(notebooks)').all() as Array<{ name: string }>
    expect(cols.map((col) => col.name)).toEqual(
      expect.arrayContaining(['sort_order', 'cover_tone', 'cover_icon', 'cover_image'])
    )
  })

  it('repository 可创建笔记本并写 chunk', async () => {
    await manager.connect(tempDir)
    const repo = new KnowledgeRepository(manager.getDb())
    const nb = await repo.createNotebook({ id: 'nb_test', name: '测试本', vaultId: 'vault_test' })
    expect(nb.name).toBe('测试本')

    const src = await repo.upsertSource({
      id: 'src_1',
      notebookId: nb.id,
      title: 'a.txt',
      sourceKind: 'text',
      contentHash: 'abc',
      status: 'ready',
      byteSize: 3,
      vaultId: 'vault_test'
    })
    expect(src.id).toBe('src_1')

    const dim = 4
    const embedding = Buffer.from(new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer)
    await repo.insertChunk({
      chunkId: 'c1',
      notebookId: nb.id,
      sourceId: src.id,
      chunkIndex: 0,
      chunkText: 'hello knowledge',
      embedding,
      dimension: dim,
      modelId: 'mock',
      vaultId: 'vault_test'
    })

    const hits = await repo.searchChunksLike(nb.id, 'knowledge')
    expect(hits.length).toBe(1)
    expect(hits[0]?.chunkText).toContain('knowledge')

    const listed = await repo.listChunksByNotebook({ notebookId: nb.id, limit: 10, offset: 0 })
    expect(listed.total).toBe(1)
    expect(listed.items[0]?.chunkId).toBe('c1')
    expect(listed.items[0]?.sourceTitle).toBe('a.txt')
    expect(listed.items[0]?.chunkText).toContain('knowledge')
    expect(listed.items[0]).not.toHaveProperty('embedding')

    const filtered = await repo.listChunksByNotebook({
      notebookId: nb.id,
      query: 'missing-term',
      limit: 10,
      offset: 0
    })
    expect(filtered.total).toBe(0)
    expect(filtered.items).toEqual([])

    const purged = await repo.deleteAllForVault('vault_test')
    expect(purged.notebooks).toBe(1)
    expect(await repo.getNotebook(nb.id)).toBeNull()
  })
})

describe('KnowledgeConnectionManager availability', () => {
  it('记录 better-sqlite3 是否可被当前 Node 打开', () => {
    // 供 CI / 夜班复查：ABI 不匹配时上面套件会 skip，此处显式打点
    expect(typeof canOpenBetterSqlite3()).toBe('boolean')
  })
})
