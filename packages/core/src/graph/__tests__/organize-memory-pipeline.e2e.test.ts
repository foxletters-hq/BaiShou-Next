import * as fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/libsql'
import { md5Hex } from '../../fs/md5'

const dbRequire = createRequire(new URL('../../../../database/package.json', import.meta.url))
const { createClient } = dbRequire('@libsql/client') as {
  createClient: (config: { url: string }) => {
    execute: (stmt: string | { sql: string; args?: unknown[] }) => Promise<{ rows: unknown[] }>
    close: () => void
  }
}
type Client = ReturnType<typeof createClient>
import {
  EMBED_LEDGER_CREATE_SQL,
  EMBED_LEDGER_INDEXES_SQL,
  GRAPH_EDGES_CREATE_SQL,
  GRAPH_INDEXES_SQL,
  GRAPH_NODE_ALIASES_CREATE_SQL,
  GRAPH_NODES_CREATE_SQL,
  GraphRepository,
  MEMORY_EMBEDDINGS_CREATE_SQL,
  MEMORY_EMBEDDINGS_INDEX_SQL,
  MEMORY_EMBEDDINGS_VAULT_INDEX_SQL,
  SqliteHybridSearchRepository
} from '@baishou/database'
import {
  buildDiaryEmbeddingSourceId,
  hashEmbedSourceContent,
  MEMORY_EMBED_GROUP_ID
} from '@baishou/shared'
import { NodeFileSystem } from '../../fs/node-file-system'
import { bindPendingReextractCollaborators } from '../../raw-data/bind-pending-reextract'
import { DerivedFreshnessService } from '../../raw-data/derived-freshness.service'
import { GraphSyncService } from '../../raw-data/graph-sync.service'
import { GraphRawManager } from '../../raw-data/managers/graph.raw-manager'
import { MemoryRawManager } from '../../raw-data/managers/memory.raw-manager'
import { MemorySyncService } from '../../raw-data/memory-sync.service'
import type { IStoragePathService } from '../../vault/storage-path.types'
import { GraphLlmExtractionService } from '../graph-llm-extraction.service'
import { backfillUnembeddedGraphNodes } from '../graph-node-embed-backfill'

const VAULT_ID = 'vlt_e2e_organize_001'
const VAULT_NAME = 'Personal'
const MODEL_ID = 'test-embed-model'

function deterministicVector(text: string): number[] {
  let h1 = 0
  let h2 = 0
  let h3 = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = (h1 * 31 + code) % 997
    h2 = (h2 * 37 + code) % 991
    h3 = (h3 * 41 + code) % 983
  }
  const norm = Math.sqrt(h1 * h1 + h2 * h2 + h3 * h3) || 1
  return [h1 / norm, h2 / norm, h3 / norm]
}

describe('Organize Memory E2E Pipeline (整理记忆全链路集成测试)', () => {
  let tmpDir: string
  let client: Client
  let hsRepo: SqliteHybridSearchRepository
  let graphRepo: GraphRepository
  let freshness: DerivedFreshnessService
  let memoryManager: MemoryRawManager
  let graphManager: GraphRawManager
  let nodeFs: NodeFileSystem
  let pathService: IStoragePathService
  let journals: Array<{ filePath: string; contentHash: string; date: string }>

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'organize-memory-e2e-'))
    await fs.mkdir(path.join(tmpDir, 'Journals'), { recursive: true })
    await fs.mkdir(path.join(tmpDir, 'Memory'), { recursive: true })
    await fs.mkdir(path.join(tmpDir, 'Graph'), { recursive: true })

    client = createClient({ url: ':memory:' })
    await client.execute(MEMORY_EMBEDDINGS_CREATE_SQL)
    await client.execute(MEMORY_EMBEDDINGS_INDEX_SQL)
    await client.execute(MEMORY_EMBEDDINGS_VAULT_INDEX_SQL)
    await client.execute(EMBED_LEDGER_CREATE_SQL)
    for (const idxSql of EMBED_LEDGER_INDEXES_SQL) {
      await client.execute(idxSql)
    }
    await client.execute(GRAPH_NODES_CREATE_SQL)
    await client.execute(GRAPH_NODE_ALIASES_CREATE_SQL)
    await client.execute(GRAPH_EDGES_CREATE_SQL)
    for (const idxSql of GRAPH_INDEXES_SQL) {
      await client.execute(idxSql)
    }

    hsRepo = new SqliteHybridSearchRepository(client)
    await hsRepo.initVectorIndex(3)
    graphRepo = new GraphRepository(drizzle(client as never) as never)

    nodeFs = new NodeFileSystem()
    pathService = {
      getGraphBaseDirectory: async () => path.join(tmpDir, 'Graph'),
      getMemoryBaseDirectory: async () => path.join(tmpDir, 'Memory'),
      getJournalsBaseDirectory: async () => path.join(tmpDir, 'Journals'),
      getSummariesBaseDirectory: async () => path.join(tmpDir, 'Summaries'),
      getSessionsBaseDirectory: async () => path.join(tmpDir, 'Sessions'),
      getActiveVaultPath: async () => tmpDir
    } as unknown as IStoragePathService

    freshness = new DerivedFreshnessService()
    memoryManager = new MemoryRawManager(pathService, nodeFs, freshness)
    graphManager = new GraphRawManager(pathService, nodeFs, freshness)

    const d1Content = '今天和小张一起讨论了白手项目的架构优化。'
    const d2Content = '和小张（张伟）继续推进白手项目，解决了批量入库瓶颈。'
    const d3Content = '今天和小李复盘了移动端同步体验。'

    await fs.writeFile(path.join(tmpDir, 'Journals/2026-07-01.md'), d1Content, 'utf8')
    await fs.writeFile(path.join(tmpDir, 'Journals/2026-07-02.md'), d2Content, 'utf8')
    await fs.writeFile(path.join(tmpDir, 'Journals/2026-07-03.md'), d3Content, 'utf8')

    journals = [
      {
        filePath: 'Journals/2026-07-01.md',
        contentHash: md5Hex(d1Content),
        date: '2026-07-01'
      },
      {
        filePath: 'Journals/2026-07-02.md',
        contentHash: md5Hex(d2Content),
        date: '2026-07-02'
      },
      {
        filePath: 'Journals/2026-07-03.md',
        contentHash: md5Hex(d3Content),
        date: '2026-07-03'
      }
    ]

    bindPendingReextractCollaborators({
      freshness,
      graphManager,
      shadowRepo: {
        listAll: async () => journals
      } as never,
      getVaultName: () => VAULT_NAME,
      getVaultId: () => VAULT_ID
    })
  })

  afterEach(async () => {
    client?.close()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('executes diary embed, batch memory sync, batch graph extraction/commit, re-extract edge supersede, and node vector backfill end-to-end', async () => {
    // =========================================================================
    // 1. 日记向量化入库（模拟第一阶段：日记嵌入完成并登记 embed_ledger）
    // =========================================================================
    for (let i = 0; i < journals.length; i++) {
      const j = journals[i]!
      const sourceId = buildDiaryEmbeddingSourceId(VAULT_ID, i + 1)
      await hsRepo.replaceSourceEmbeddings({
        sourceType: 'diary',
        sourceId,
        groupId: 'diary',
        vaultId: VAULT_ID,
        metadataJson: JSON.stringify({
          date: j.date,
          updated_at: Date.now(),
          content_hash: j.contentHash
        }),
        modelId: MODEL_ID,
        dimension: 3,
        contentHash: j.contentHash,
        recordLedger: true,
        chunks: [
          {
            id: `diary-${i + 1}_chunk_0`,
            chunkIndex: 0,
            chunkText: `日记内容 ${j.date}`,
            embedding: deterministicVector(j.filePath)
          }
        ]
      })
    }

    const diaryLedger = await hsRepo.listLedgerBySource('diary', { vaultId: VAULT_ID })
    expect(diaryLedger).toHaveLength(3)

    // =========================================================================
    // 2. 伙伴记忆同步与批量嵌入（验证 embedTextsBatch 批量调用与分片缓存复用）
    // =========================================================================
    const now = Date.now()
    for (let i = 1; i <= 4; i++) {
      await memoryManager.writeRecord({
        id: `mem-${i}`,
        schemaVersion: 1,
        vaultId: VAULT_ID,
        vaultName: VAULT_NAME,
        content: `伙伴记忆条目 ${i}：用户偏好高效简洁的工程方案`,
        sourceType: 'memory',
        origin: 'ai',
        shardMonth: '2026-07',
        createdAt: now + i,
        updatedAt: now + i,
        deletedAt: null
      })
    }

    const embedTextsBatchSpy = vi.fn(
      async (
        items: Array<{
          text: string
          sourceType: string
          sourceId: string
          groupId: string
          vaultId: string
          metadataJson?: string
          sourceCreatedAt?: number
        }>
      ) => {
        for (const item of items) {
          await hsRepo.replaceSourceEmbeddings({
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            groupId: MEMORY_EMBED_GROUP_ID,
            vaultId: item.vaultId,
            metadataJson: item.metadataJson ?? '{}',
            modelId: MODEL_ID,
            dimension: 3,
            contentHash: hashEmbedSourceContent(item.text),
            recordLedger: true,
            sourceCreatedAt: item.sourceCreatedAt,
            chunks: [
              {
                id: `${item.sourceId}_chunk_0`,
                chunkIndex: 0,
                chunkText: item.text,
                embedding: deterministicVector(item.text)
              }
            ]
          })
        }
      }
    )
    const embedTextSingleSpy = vi.fn()

    const memorySync = new MemorySyncService(memoryManager, {
      embedText: embedTextSingleSpy,
      embedTextsBatch: embedTextsBatchSpy,
      deleteBySource: (sourceType, sourceId) =>
        hsRepo.deleteEmbeddingsBySource(sourceType, sourceId),
      listLedgerBySource: (sourceType, opts) => hsRepo.listLedgerBySource(sourceType, opts),
      listSourceIdsByType: (sourceType, opts) =>
        hsRepo.listSourceIdsByType(sourceType, {
          groupId: opts?.groupId ?? MEMORY_EMBED_GROUP_ID,
          vaultId: opts?.vaultId
        })
    })

    const memResult1 = await memorySync.syncPendingIndex({
      vaultId: VAULT_ID,
      vaultName: VAULT_NAME,
      embedMissing: true
    })
    expect(memResult1.upserted).toBe(4)
    expect(embedTextsBatchSpy).toHaveBeenCalledTimes(1)
    expect(embedTextsBatchSpy.mock.calls[0]?.[0]).toHaveLength(4)
    expect(embedTextSingleSpy).not.toHaveBeenCalled()

    // 验证第二次 countPendingFromShards / syncPendingIndex 命中内存缓存，不再重读 JSONL 分片
    const readFileSpy = vi.spyOn(nodeFs, 'readFile')
    const pendingMemCount = await memorySync.countPendingFromShards({
      vaultId: VAULT_ID
    })
    expect(pendingMemCount).toBe(0)
    const jsonlReadsDuringCount = readFileSpy.mock.calls.filter(([p]) =>
      String(p).endsWith('2026-07.jsonl')
    )
    expect(jsonlReadsDuringCount).toHaveLength(0)
    readFileSpy.mockRestore()

    // =========================================================================
    // 3. 图谱抽取 + 批量对齐 + 批量入库（验证批量名称查找、批量节点预取、分片无残留 dirty）
    // =========================================================================
    const graphSync = new GraphSyncService(graphManager, graphRepo, null)
    const findBatchSpy = vi.spyOn(graphRepo, 'findNodesByNamesOrAliasesBatch')
    const getNodesByIdsSpy = vi.spyOn(graphRepo, 'getNodesByIds')
    const getNodeByIdSpy = vi.spyOn(graphRepo, 'getNodeById')

    const mockLlm = vi.fn(async (input: { system: string; user: string }) => {
      if (input.system.includes('实体对齐')) {
        return JSON.stringify({ merges: [] })
      }
      if (input.user.includes('2026-07-01')) {
        return JSON.stringify({
          entities: [
            { name: '小张', type: 'person', aliases: [], summary: '架构师同事', confidence: 92 },
            { name: '白手项目', type: 'project', aliases: [], summary: '核心项目', confidence: 95 }
          ],
          edges: [
            {
              from: '小张',
              to: '白手项目',
              type: 'participates_in',
              excerpt: '和小张一起讨论了白手项目的架构优化',
              confidence: 90
            }
          ]
        })
      }
      if (input.user.includes('2026-07-02')) {
        return JSON.stringify({
          entities: [
            {
              name: '小张',
              type: 'person',
              aliases: ['张伟'],
              summary: '负责性能优化的架构师同事',
              confidence: 95
            },
            { name: '白手项目', type: 'project', aliases: [], summary: '核心项目', confidence: 95 }
          ],
          edges: [
            {
              from: '小张',
              to: '白手项目',
              type: 'participates_in',
              excerpt: '和小张（张伟）继续推进白手项目',
              confidence: 92
            }
          ]
        })
      }
      return JSON.stringify({
        entities: [
          { name: '小李', type: 'person', aliases: [], summary: '移动端同事', confidence: 88 }
        ],
        edges: [
          {
            from: '小李',
            to: '2026-07-03',
            type: 'mentions',
            excerpt: '和小李复盘了移动端同步体验',
            confidence: 85
          }
        ]
      })
    })

    const extractionService = new GraphLlmExtractionService(
      graphManager,
      freshness,
      graphRepo,
      graphSync,
      pathService,
      nodeFs,
      mockLlm,
      {
        isEmbeddingConfigured: () => true,
        isDiaryEmbedded: async () => true,
        embedQuery: async (text) => deterministicVector(text),
        embedBatch: async (texts) => texts.map((t) => deterministicVector(t))
      }
    )

    const initialPendingReextract = await freshness.listPendingReextract()
    expect(initialPendingReextract).toHaveLength(3)

    const drafts = await Promise.all(
      initialPendingReextract.map((item) =>
        extractionService.extractDraft({
          vaultId: VAULT_ID,
          vaultName: VAULT_NAME,
          filePath: item.filePath,
          contentHash: item.contentHash,
          selfName: '我'
        })
      )
    )

    const commitResults = await extractionService.commitDrafts(drafts)
    expect(commitResults).toHaveLength(3)
    expect(commitResults.every((r) => !r.error)).toBe(true)

    // 验证使用了批量接口而非逐个 N+1 查询
    expect(findBatchSpy).toHaveBeenCalled()
    expect(getNodesByIdsSpy).toHaveBeenCalled()
    expect(getNodeByIdSpy).not.toHaveBeenCalled()

    // 验证同一批草稿中“小张”节点的别名与摘要被正确合并（nodeCache 生效）
    const zhangMatches = await graphRepo.findNodesByNameOrAlias(VAULT_ID, '张伟', 'person')
    expect(zhangMatches).toHaveLength(1)
    expect(zhangMatches[0]!.name).toBe('小张')
    expect(zhangMatches[0]!.aliases).toContain('张伟')
    expect(zhangMatches[0]!.summary).toBe('负责性能优化的架构师同事')
    expect(zhangMatches[0]!.mentionCount).toBeGreaterThanOrEqual(2)

    // 验证 commitDrafts 后 nodes / edges / extract-state 分片全部已压缩且无残留 dirty
    expect(await graphManager.listPendingIndex('nodes')).toEqual([])
    expect(await graphManager.listPendingIndex('edges')).toEqual([])
    expect(await freshness.listPendingReextract()).toEqual([])

    // 验证再次调用 listPendingReextract 命中 GraphRawManager.extractStateCache，不重读 JSONL 分片
    const extractStateReadSpy = vi.spyOn(nodeFs, 'readFile')
    expect(await freshness.listPendingReextract()).toEqual([])
    const extractStateReads = extractStateReadSpy.mock.calls.filter(
      ([p]) => String(p).includes('extract-state') && String(p).endsWith('.jsonl')
    )
    expect(extractStateReads).toHaveLength(0)
    extractStateReadSpy.mockRestore()

    // =========================================================================
    // 4. 日记修改后重抽（验证 supersedeAiEdgesBySourceRefsBatch 批量替换旧边与计数重算）
    // =========================================================================
    const d1UpdatedContent = '今天和小李一起讨论了移动端性能调优。'
    const d1UpdatedHash = md5Hex(d1UpdatedContent)
    journals[0]!.contentHash = d1UpdatedHash
    await fs.writeFile(path.join(tmpDir, 'Journals/2026-07-01.md'), d1UpdatedContent, 'utf8')
    freshness.markPendingReextract('Journals/2026-07-01.md', d1UpdatedHash)

    const reextractList = await freshness.listPendingReextract()
    expect(reextractList.map((r) => r.filePath)).toEqual(['Journals/2026-07-01.md'])

    mockLlm.mockImplementationOnce(async () =>
      JSON.stringify({
        entities: [
          { name: '小李', type: 'person', aliases: [], summary: '移动端同事', confidence: 90 }
        ],
        edges: [
          {
            from: '小李',
            to: '2026-07-01',
            type: 'mentions',
            excerpt: '和小李一起讨论了移动端性能调优',
            confidence: 90
          }
        ]
      })
    )

    const updatedDraft = await extractionService.extractDraft({
      vaultId: VAULT_ID,
      vaultName: VAULT_NAME,
      filePath: 'Journals/2026-07-01.md',
      contentHash: d1UpdatedHash,
      selfName: '我'
    })
    const supersedeBatchSpy = vi.spyOn(graphManager, 'supersedeAiEdgesBySourceRefsBatch')
    const recommitResults = await extractionService.commitDrafts([updatedDraft])
    expect(recommitResults[0]?.error).toBeUndefined()
    expect(supersedeBatchSpy).toHaveBeenCalledTimes(1)
    expect(await freshness.listPendingReextract()).toEqual([])
    expect(await graphManager.listPendingIndex('nodes')).toEqual([])
    expect(await graphManager.listPendingIndex('edges')).toEqual([])

    // =========================================================================
    // 5. 图谱节点向量批量补齐（验证 backfillUnembeddedGraphNodes 完成后待补齐为 0）
    // =========================================================================
    const unembeddedBefore = await graphRepo.listUnembeddedLiveNodes(VAULT_ID)
    expect(unembeddedBefore.length).toBeGreaterThan(0)

    const backfillResult = await backfillUnembeddedGraphNodes({
      vaultId: VAULT_ID,
      modelId: MODEL_ID,
      listUnembeddedLiveNodes: (vid) => graphRepo.listUnembeddedLiveNodes(vid),
      updateNodeEmbedding: (id, vid, vec, mid) => graphRepo.updateNodeEmbedding(id, vid, vec, mid),
      updateNodeEmbeddingsBatch: (vid, mid, items) =>
        graphRepo.updateNodeEmbeddingsBatch(vid, mid, items),
      embedQuery: async (text) => deterministicVector(text),
      embedBatch: async (texts) => texts.map((t) => deterministicVector(t))
    })

    expect(backfillResult.failed).toBe(0)
    expect(backfillResult.updated).toBe(unembeddedBefore.length)

    const unembeddedAfter = await graphRepo.listUnembeddedLiveNodes(VAULT_ID)
    expect(unembeddedAfter).toEqual([])
  })
})
