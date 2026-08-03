import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { embeddingVectorToBytes } from '@baishou/shared'
import { KnowledgeSearchService } from '../knowledge-search.service'
import {
  KnowledgeAskService,
  resolvePageForOffset
} from '../knowledge-ask.service'

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

describe('resolvePageForOffset', () => {
  const pages = [
    { page: 1, start: 0, end: 100 },
    { page: 2, start: 100, end: 250 }
  ]

  it('L2 按偏移命中页码', () => {
    expect(resolvePageForOffset(pages, 0)).toBe(1)
    expect(resolvePageForOffset(pages, 99)).toBe(1)
    expect(resolvePageForOffset(pages, 100)).toBe(2)
    expect(resolvePageForOffset(pages, 249)).toBe(2)
    expect(resolvePageForOffset(pages, 250)).toBe(2)
  })

  it('无 pages 时不返回页码', () => {
    expect(resolvePageForOffset(null, 10)).toBeUndefined()
    expect(resolvePageForOffset(pages, undefined)).toBeUndefined()
  })
})

describe('KnowledgeSearchService notebook isolation', () => {
  it('缺 notebookId 时抛错（fail-closed）', async () => {
    const search = new KnowledgeSearchService({
      sql: { all: () => [] }
    })
    await expect(
      search.search({ notebookId: '', query: '对齐', queryVector: [1, 0, 0] })
    ).rejects.toThrow(/notebookId/)
  })

  it('强制 notebook 隔离：SQL 结果中异本行被丢弃', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = []
    const search = new KnowledgeSearchService({
      sql: {
        all: (sql, params = []) => {
          calls.push({ sql, params })
          if (sql.includes('vec_distance_cosine')) {
            throw new Error('no vec')
          }
          if (sql.includes('knowledge_chunks_fts')) {
            return [
              {
                chunkId: 'c_a',
                sourceId: 'src_a',
                notebookId: 'nb_a',
                chunkIndex: 0,
                chunkText: '本笔记本内容',
                metadataJson: '{"offset":0,"len":6}',
                ftsRank: -1
              },
              // 防御性：即便 SQL 漏过滤，服务层仍丢弃异本
              {
                chunkId: 'c_b',
                sourceId: 'src_b',
                notebookId: 'nb_b',
                chunkIndex: 0,
                chunkText: '异本内容',
                metadataJson: '{}',
                ftsRank: -2
              }
            ]
          }
          // JS cosine 路径
          return [
            {
              chunkId: 'c_a',
              sourceId: 'src_a',
              notebookId: 'nb_a',
              chunkIndex: 0,
              chunkText: '本笔记本内容',
              metadataJson: '{"offset":0,"len":6}',
              embedding: embeddingVectorToBytes([1, 0, 0]),
              dimension: 3
            }
          ]
        }
      }
    })

    const hits = await search.search({
      notebookId: 'nb_a',
      query: '本笔记本',
      queryVector: [1, 0, 0],
      topK: 10
    })

    expect(hits.every((h) => h.notebookId === 'nb_a')).toBe(true)
    expect(hits.some((h) => h.sourceId === 'src_b')).toBe(false)
    expect(calls.some((c) => c.params.includes('nb_a'))).toBe(true)
    expect(calls.some((c) => c.sql.includes('vec_distance_cosine'))).toBe(true)
  })
})

const describeSearchDb = canOpenBetterSqlite3() ? describe : describe.skip

describeSearchDb('KnowledgeSearchService notebook isolation (sqlite)', () => {
  let tempDir: string
  let dbManager: {
    connect: (d: string) => Promise<void>
    disconnect: () => void
    getSqlite: () => import('better-sqlite3').Database
    getDb: () => any
  }

  beforeEach(async () => {
    const { KnowledgeConnectionManager, KnowledgeRepository } = await import('@baishou/database')
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-kb-search-'))
    dbManager = new KnowledgeConnectionManager()
    await dbManager.connect(tempDir)
    const repo = new KnowledgeRepository(dbManager.getDb())

    await repo.createNotebook({ id: 'nb_a', name: 'A' })
    await repo.createNotebook({ id: 'nb_b', name: 'B' })
    await repo.upsertSource({
      id: 'src_a',
      notebookId: 'nb_a',
      title: 'alpha.md',
      sourceKind: 'text',
      contentHash: 'ha',
      status: 'ready'
    })
    await repo.upsertSource({
      id: 'src_b',
      notebookId: 'nb_b',
      title: 'beta.md',
      sourceKind: 'text',
      contentHash: 'hb',
      status: 'ready'
    })

    const vecA = embeddingVectorToBytes([1, 0, 0])
    const vecB = embeddingVectorToBytes([0, 1, 0])
    await repo.insertChunk({
      chunkId: 'c_a',
      notebookId: 'nb_a',
      sourceId: 'src_a',
      chunkIndex: 0,
      chunkText: '对齐与可解释性是 AI 安全的核心议题',
      metadataJson: JSON.stringify({ offset: 0, len: 20 }),
      embedding: Buffer.from(vecA),
      dimension: 3,
      modelId: 'mock'
    })
    await repo.insertChunk({
      chunkId: 'c_b',
      notebookId: 'nb_b',
      sourceId: 'src_b',
      chunkIndex: 0,
      chunkText: '对齐与可解释性是另一本笔记本的私有内容',
      metadataJson: JSON.stringify({ offset: 0, len: 22 }),
      embedding: Buffer.from(vecB),
      dimension: 3,
      modelId: 'mock'
    })
  })

  afterEach(() => {
    try {
      dbManager.disconnect()
    } catch {
      /* ignore */
    }
  })

  function buildSearch() {
    const sqlite = dbManager.getSqlite()
    return new KnowledgeSearchService({
      sql: {
        all: (sql, params = []) =>
          sqlite.prepare(sql).all(...params) as Array<Record<string, unknown>>
      },
      getSourceTitle: async (id) => (id === 'src_a' ? 'alpha.md' : id === 'src_b' ? 'beta.md' : null)
    })
  }

  it('强制 notebook 隔离：不会串到另一本', async () => {
    const search = buildSearch()
    const hits = await search.search({
      notebookId: 'nb_a',
      query: '对齐与可解释性',
      queryVector: [1, 0, 0],
      topK: 10
    })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.notebookId === 'nb_a')).toBe(true)
    expect(hits.every((h) => h.sourceId === 'src_a')).toBe(true)
    expect(hits.some((h) => h.sourceId === 'src_b')).toBe(false)
  })
})

describe('KnowledgeAskService citations', () => {
  it('组装 L1 偏移与 L2 页码引用', async () => {
    const search = {
      search: async () => [
        {
          chunkId: 'c1',
          sourceId: 'src1',
          notebookId: 'nb1',
          chunkIndex: 0,
          chunkText: '第一段关于对齐的讨论。',
          score: 0.9,
          source: 'hybrid' as const,
          offset: 120,
          len: 12,
          title: 'report.pdf'
        }
      ]
    }

    const ask = new KnowledgeAskService({
      search: search as any,
      embedQuery: async () => [1, 0, 0],
      generateAnswer: async () => '根据资料[1]，对齐存在主要分歧。',
      getPageBoundaries: async () => [
        { page: 1, start: 0, end: 100 },
        { page: 2, start: 100, end: 200 }
      ]
    })

    const result = await ask.ask({ notebookId: 'nb1', question: '对齐分歧是什么？' })
    expect(result.answer).toContain('对齐')
    expect(result.citations).toHaveLength(1)
    expect(result.citations[0]).toMatchObject({
      sourceId: 'src1',
      title: 'report.pdf',
      chunkIndex: 0,
      offset: 120,
      len: 12,
      page: 2
    })
    expect(result.citations[0]?.excerpt).toContain('对齐')
  })

  it('缺 notebookId / question 时 fail-closed', async () => {
    const ask = new KnowledgeAskService({
      search: { search: async () => [] } as any,
      embedQuery: async () => [1],
      generateAnswer: async () => ''
    })
    await expect(ask.ask({ notebookId: '', question: 'q' })).rejects.toThrow(/notebookId/)
    await expect(ask.ask({ notebookId: 'nb', question: '  ' })).rejects.toThrow(/question/)
  })
})
