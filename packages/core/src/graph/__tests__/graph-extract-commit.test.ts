import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR,
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  GRAPH_EXTRACT_EMPTY_RESPONSE_ERROR,
  entryNodeIdForFilePath,
  graphNodeCardText,
  graphNodeIdForEntity,
  legacyEntryNodeIdForFilePath
} from '@baishou/shared'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../../raw-data/derived-freshness.service'
import { GraphSyncService } from '../../raw-data/graph-sync.service'
import { GraphRawManager } from '../../raw-data/managers/graph.raw-manager'
import { GraphLlmExtractionService } from '../graph-llm-extraction.service'

const FILE = 'Journal/2026/03/15.md'

function createService(overrides?: {
  llm?: (input: {
    system: string
    user: string
    signal?: AbortSignal
    onDelta?: (chars: number) => void
    onReasoning?: (chars: number) => void
  }) => Promise<string | null>
  alignDeps?: ConstructorParameters<typeof GraphLlmExtractionService>[7]
  writeRecord?: ReturnType<typeof vi.fn>
  removeRecordsFromShard?: ReturnType<typeof vi.fn>
  listEdgesTouching?: ReturnType<typeof vi.fn>
  syncPendingIndex?: ReturnType<typeof vi.fn>
  searchNodesByVector?: ReturnType<typeof vi.fn>
  getNodeById?: ReturnType<typeof vi.fn>
  findNodeByNameOrAlias?: (vaultId: string, name: string, type?: string) => Promise<unknown>
  findNodesByNameOrAlias?: (vaultId: string, name: string, type?: string) => Promise<unknown[]>
  recountMentions?: ReturnType<typeof vi.fn>
}) {
  const writeRecord = overrides?.writeRecord ?? vi.fn(async () => undefined)
  const removeRecordsFromShard = overrides?.removeRecordsFromShard ?? vi.fn(async () => 0)
  const listEdgesTouching = overrides?.listEdgesTouching ?? vi.fn(async () => [])
  const syncPendingIndex = overrides?.syncPendingIndex ?? vi.fn(async () => undefined)
  const commitReextract = vi.fn(async () => undefined)
  const recountMentions = overrides?.recountMentions ?? vi.fn(async () => undefined)
  const getNodeById = overrides?.getNodeById ?? vi.fn(async () => null)
  const findNodeByNameOrAlias = vi.fn(overrides?.findNodeByNameOrAlias ?? (async () => null))
  const findNodesByNameOrAlias = vi.fn(
    overrides?.findNodesByNameOrAlias ??
      (async (vaultId: string, name: string, type?: string) => {
        const one = await findNodeByNameOrAlias(vaultId, name, type)
        return one ? [one] : []
      })
  )
  const service = new GraphLlmExtractionService(
    {
      writeRecord,
      removeRecordsFromShard,
      supersedeAiEdgesBySourceRef: vi.fn(async () => undefined),
      compactShard: vi.fn(async () => undefined)
    } as never,
    {
      listPendingReextract: vi.fn(async () => [{ filePath: FILE, contentHash: 'hash-1' }]),
      commitReextract
    } as never,
    {
      findNodeByNameOrAlias,
      findNodesByNameOrAlias,
      getNodeById,
      listEdgesTouching,
      searchNodesByName: vi.fn(async () => []),
      searchNodesByVector: overrides?.searchNodesByVector ?? vi.fn(async () => []),
      recountMentions
    } as never,
    { syncPendingIndex } as never,
    { getActiveVaultPath: async () => 'D:/vault' } as never,
    {
      exists: async () => true,
      readFile: async () => '今天和小张吃饭'
    } as never,
    overrides?.llm ??
      (async () =>
        JSON.stringify({
          entities: [
            { name: '小张', type: 'person', aliases: [], summary: '同事', confidence: 90 }
          ],
          edges: [
            { from: '小张', to: '2026-03-15', type: 'mentions', excerpt: '吃饭', confidence: 80 }
          ]
        })),
    overrides?.alignDeps
  )
  return {
    service,
    writeRecord,
    removeRecordsFromShard,
    syncPendingIndex,
    commitReextract,
    recountMentions,
    getNodeById
  }
}

function precomputedFromSync(
  syncPendingIndex: ReturnType<typeof vi.fn>
): Map<string, { embedding: number[]; text: string }> {
  const opts = syncPendingIndex.mock.calls[0]?.[0] as
    | { precomputedNodeEmbeddings?: Map<string, { embedding: number[]; text: string }> }
    | undefined
  return opts?.precomputedNodeEmbeddings ?? new Map()
}

describe('GraphLlmExtractionService draft/commit', () => {
  it('extractDraft does not write until commitDrafts', async () => {
    const { service, writeRecord, syncPendingIndex, commitReextract } = createService()
    const draft = await service.extractDraft({
      vaultId: 'vlt_aaaaaaaaaaaaaaaa',
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    expect(draft.entities[0]?.name).toBe('小张')
    expect(writeRecord).not.toHaveBeenCalled()
    expect(syncPendingIndex).not.toHaveBeenCalled()

    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    expect(writeRecord).toHaveBeenCalled()
    expect(syncPendingIndex).toHaveBeenCalledTimes(1)
    expect(commitReextract).toHaveBeenCalledTimes(1)
  })

  it('asks the model a second time to merge onto an existing node', async () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const existingId = graphNodeIdForEntity(vaultId, 'person', '张三')
    const llm = vi.fn(async (input: { system: string; user: string }) => {
      if (input.system.includes('实体对齐')) {
        return JSON.stringify({ merges: [{ incoming: 'i1', existing: 'e1' }] })
      }
      return JSON.stringify({
        entities: [{ name: '小张', type: 'person', aliases: [], summary: '同事', confidence: 90 }],
        edges: [
          { from: '小张', to: '2026-03-15', type: 'mentions', excerpt: '吃饭', confidence: 80 }
        ]
      })
    })
    const { service, writeRecord } = createService({
      llm,
      alignDeps: {
        isEmbeddingConfigured: () => true,
        isDiaryEmbedded: () => true,
        embedQuery: async () => [1, 0]
      },
      searchNodesByVector: vi.fn(async () => [
        {
          id: existingId,
          name: '张三',
          aliases: ['三哥'],
          summary: '同事',
          nodeType: 'person',
          distance: 0.35
        }
      ])
    })
    const draft = await service.extractDraft({
      vaultId,
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    expect(llm.mock.calls.some((call) => call[0].system.includes('实体对齐'))).toBe(true)
    const person = writeRecord.mock.calls
      .map((call) => call[0] as { nodeType?: string; id?: string; aliases?: string[] })
      .find((record) => record.nodeType === 'person')
    expect(person?.id).toBe(existingId)
    expect(person?.aliases).toEqual(expect.arrayContaining(['小张', '三哥']))
  })

  it('rejects extract when embedding is not configured', async () => {
    const { service } = createService({
      alignDeps: { isEmbeddingConfigured: () => false }
    })
    await expect(
      service.extractDraft({
        vaultId: 'vlt_aaaaaaaaaaaaaaaa',
        vaultName: 'Personal',
        filePath: FILE,
        selfName: '小明'
      })
    ).rejects.toThrow(GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR)
  })

  it('rejects a diary that is not in the vector store', async () => {
    const { service } = createService({
      alignDeps: {
        isEmbeddingConfigured: () => true,
        isDiaryEmbedded: () => false
      }
    })
    await expect(
      service.extractDraft({
        vaultId: 'vlt_aaaaaaaaaaaaaaaa',
        vaultName: 'Personal',
        filePath: FILE,
        selfName: '小明'
      })
    ).rejects.toThrow(GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR)
  })

  it('extractDraft ends the in-flight LLM call when the signal aborts', async () => {
    const ac = new AbortController()
    const { service } = createService({
      llm: ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => reject(new DOMException('The operation was aborted', 'AbortError')),
            { once: true }
          )
        })
    })
    const pending = service.extractDraft({
      vaultId: 'vlt_aaaaaaaaaaaaaaaa',
      vaultName: 'Personal',
      filePath: FILE,
      selfName: '小明',
      signal: ac.signal
    })
    ac.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('reports stage progress without streaming char counts', async () => {
    const updates: Array<{ phase?: string; detail?: string }> = []
    const { service } = createService({
      llm: async ({ onDelta }) => {
        onDelta?.(12)
        onDelta?.(40)
        return JSON.stringify({
          entities: [
            { name: '小张', type: 'person', aliases: [], summary: '同事', confidence: 90 }
          ],
          edges: [
            { from: '小张', to: '2026-03-15', type: 'mentions', excerpt: '吃饭', confidence: 80 }
          ]
        })
      }
    })
    await service.extractDraft({
      vaultId: 'vlt_aaaaaaaaaaaaaaaa',
      vaultName: 'Personal',
      filePath: FILE,
      selfName: '小明',
      onProgress: (update) => updates.push(update)
    })
    expect(updates.map((u) => u.phase)).toEqual(['reading', 'model', 'parsing'])
    expect(updates.every((u) => u.detail == null)).toBe(true)
  })

  it('rejects extract when the model returns no text', async () => {
    const { service } = createService({
      llm: async () => null
    })
    await expect(
      service.extractDraft({
        vaultId: 'vlt_aaaaaaaaaaaaaaaa',
        vaultName: 'Personal',
        filePath: FILE,
        selfName: '小明'
      })
    ).rejects.toThrow(GRAPH_EXTRACT_EMPTY_RESPONSE_ERROR)
  })

  it('writes recount mentionCount back to JSONL after commit', async () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const personId = graphNodeIdForEntity(vaultId, 'person', '小张')
    const existing = {
      id: personId,
      vaultId,
      nodeType: 'person',
      name: '小张',
      aliases: ['小张'],
      summary: '',
      propsJson: '{}',
      mentionCount: 5,
      firstSeenAt: 1,
      lastSeenAt: 1,
      origin: 'ai',
      shardMonth: '2026-03',
      reviewStatus: 'approved',
      createdAt: 1,
      updatedAt: 10,
      deletedAt: null
    }
    let recounted = false
    const { service, writeRecord, recountMentions } = createService({
      findNodeByNameOrAlias: vi.fn(async () => existing),
      getNodeById: vi.fn(async (id: string) => {
        if (id !== personId) return null
        return recounted ? { ...existing, mentionCount: 3, updatedAt: 10 } : existing
      }),
      recountMentions: vi.fn(async () => {
        recounted = true
      })
    })
    const draft = await service.extractDraft({
      vaultId,
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    expect(recountMentions).toHaveBeenCalled()
    const personWrites = writeRecord.mock.calls
      .map((call) => call[0] as { id?: string; mentionCount?: number; updatedAt?: number })
      .filter((record) => record.id === personId)
    const persist = personWrites[0]
    const writeback = [...personWrites].reverse().find((record) => record.mentionCount === 3)
    expect(persist?.mentionCount).toBe(5)
    expect(writeback?.mentionCount).toBe(3)
    expect(writeback!.updatedAt).toBeGreaterThan(persist!.updatedAt ?? 0)
  })

  it('remaps user edges from the legacy entry before removing that node', async () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const legacyId = legacyEntryNodeIdForFilePath(FILE)
    const entryId = entryNodeIdForFilePath(FILE, vaultId)
    const removeRecordsFromShard = vi.fn(async () => 1)
    const { service, writeRecord } = createService({
      removeRecordsFromShard,
      listEdgesTouching: vi.fn(async () => [
        {
          id: 'e-user',
          fromId: 'person-1',
          toId: legacyId,
          edgeType: 'mentions',
          propsJson: '{}',
          validFrom: 1,
          validTo: null,
          isCurrent: true,
          sourceKind: 'manual',
          sourceRef: 'user',
          sourceExcerpt: '',
          sourceContentHash: null,
          confidence: 100,
          origin: 'user',
          reviewStatus: 'approved',
          shardMonth: '2026-03',
          createdAt: 1
        }
      ]),
      getNodeById: vi.fn(async (id: string) => {
        if (id !== legacyId) return null
        return {
          id: legacyId,
          vaultId,
          nodeType: 'entry',
          name: '旧日记',
          aliases: [],
          summary: '',
          propsJson: '{}',
          mentionCount: 1,
          firstSeenAt: 1,
          lastSeenAt: 1,
          origin: 'ai',
          shardMonth: '2026-03',
          reviewStatus: 'approved',
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null
        }
      })
    })
    const draft = await service.extractDraft({
      vaultId,
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    const remapped = writeRecord.mock.calls
      .map((call) => call[0] as { id?: string; fromId?: string; toId?: string })
      .find((record) => record.id === 'e-user')
    expect(remapped).toEqual(
      expect.objectContaining({ id: 'e-user', fromId: 'person-1', toId: entryId })
    )
    expect(removeRecordsFromShard).toHaveBeenCalledWith('nodes', '2026-03', [legacyId])
  })

  it('should pass the alignment vector to sync when creating a new node', async () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const personId = graphNodeIdForEntity(vaultId, 'person', '小张')
    const embedQuery = vi.fn(async () => [1, 0])
    const { service, syncPendingIndex } = createService({
      alignDeps: {
        embedQuery,
        modelId: 'embed-v1'
      }
    })
    const draft = await service.extractDraft({
      vaultId,
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    expect(precomputedFromSync(syncPendingIndex).get(personId)).toEqual({
      embedding: [1, 0],
      text: graphNodeCardText('小张', '同事')
    })
  })

  it('should not pass the incoming vector when merging onto a node whose card changed', async () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const existingId = graphNodeIdForEntity(vaultId, 'person', '张三')
    const llm = vi.fn(async (input: { system: string; user: string }) => {
      if (input.system.includes('实体对齐')) {
        return JSON.stringify({ merges: [{ incoming: 'i1', existing: 'e1' }] })
      }
      return JSON.stringify({
        entities: [{ name: '小张', type: 'person', aliases: [], summary: '同事', confidence: 90 }],
        edges: [
          { from: '小张', to: '2026-03-15', type: 'mentions', excerpt: '吃饭', confidence: 80 }
        ]
      })
    })
    const { service, syncPendingIndex } = createService({
      llm,
      alignDeps: {
        embedQuery: async () => [1, 0],
        modelId: 'embed-v1'
      },
      searchNodesByVector: vi.fn(async () => [
        {
          id: existingId,
          name: '张三',
          aliases: ['三哥'],
          summary: '老朋友',
          nodeType: 'person',
          distance: 0.35
        }
      ]),
      getNodeById: vi.fn(async (id: string) => {
        if (id !== existingId) return null
        return {
          id: existingId,
          vaultId,
          nodeType: 'person',
          name: '张三',
          aliases: ['三哥'],
          summary: '老朋友',
          propsJson: '{}',
          mentionCount: 1,
          firstSeenAt: 1,
          lastSeenAt: 1,
          origin: 'ai',
          shardMonth: '2026-03',
          reviewStatus: 'approved',
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null
        }
      })
    })
    const draft = await service.extractDraft({
      vaultId,
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    expect(precomputedFromSync(syncPendingIndex).has(existingId)).toBe(false)
  })

  it('should skip precomputed embedding when a name hit never computed a vector', async () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const personId = graphNodeIdForEntity(vaultId, 'person', '小张')
    const embedQuery = vi.fn()
    const existing = {
      id: personId,
      vaultId,
      nodeType: 'person',
      name: '小张',
      aliases: ['小张'],
      summary: '同事',
      propsJson: '{}',
      mentionCount: 1,
      firstSeenAt: 1,
      lastSeenAt: 1,
      origin: 'ai',
      shardMonth: '2026-03',
      reviewStatus: 'approved',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null
    }
    const { service, syncPendingIndex } = createService({
      alignDeps: {
        embedQuery,
        modelId: 'embed-v1'
      },
      findNodeByNameOrAlias: vi.fn(async () => existing),
      getNodeById: vi.fn(async (id: string) => (id === personId ? existing : null))
    })
    const draft = await service.extractDraft({
      vaultId,
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    expect(embedQuery).not.toHaveBeenCalled()
    expect(precomputedFromSync(syncPendingIndex).has(personId)).toBe(false)
  })

  it('should write pending edges and record sourceRef when name lookup returns two people', async () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const bareId = graphNodeIdForEntity(vaultId, 'person', '张三')
    const splitId = graphNodeIdForEntity(vaultId, 'person', '张三', '同事')
    const bareRow = {
      id: bareId,
      vaultId,
      nodeType: 'person',
      name: '张三',
      aliases: ['张三'],
      summary: '第一个张三',
      propsJson: JSON.stringify({
        nameRegistry: [
          {
            discriminator: '同事',
            label: '同事',
            nodeId: splitId,
            registeredAt: 1
          }
        ]
      }),
      mentionCount: 1,
      firstSeenAt: 1,
      lastSeenAt: 1,
      origin: 'ai',
      shardMonth: '2026-03',
      reviewStatus: 'approved',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      discriminator: ''
    }
    const splitRow = {
      ...bareRow,
      id: splitId,
      name: '张三',
      aliases: ['张三'],
      propsJson: '{}',
      discriminator: '同事'
    }
    const llm = vi.fn(async (input: { system: string; user: string }) => {
      if (input.system.includes('实体对齐')) {
        throw new Error('多候选时不应再调二次判定')
      }
      return JSON.stringify({
        entities: [
          { name: '张三', type: 'person', aliases: [], summary: '日记里的张三', confidence: 90 }
        ],
        edges: [
          { from: '张三', to: '2026-03-15', type: 'mentions', excerpt: '见面', confidence: 90 }
        ]
      })
    })
    const findNodesByNameOrAlias = vi.fn(async () => [bareRow, splitRow])
    const { service, writeRecord } = createService({
      llm,
      findNodesByNameOrAlias,
      getNodeById: vi.fn(async (id: string) => {
        if (id === bareId) return bareRow
        if (id === splitId) return splitRow
        return null
      })
    })
    const draft = await service.extractDraft({
      vaultId,
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    expect(llm.mock.calls.every((call) => !call[0].system.includes('实体对齐'))).toBe(true)

    const records = writeRecord.mock.calls.map((call) => call[0] as Record<string, unknown>)
    const personWrites = records.filter((record) => record.id === bareId)
    expect(personWrites.length).toBeGreaterThan(0)
    expect(personWrites[0]?.discriminator).toBe('')
    expect(
      (personWrites[0]?.props as { ambiguousSourceRefs?: string[] } | undefined)
        ?.ambiguousSourceRefs
    ).toEqual(['2026-03-15'])

    const splitWrites = records.filter((record) => record.id === splitId)
    for (const record of splitWrites) {
      expect(record.discriminator).toBe('同事')
    }

    const edges = records.filter((record) => record.fromId === bareId || record.toId === bareId)
    expect(edges.length).toBeGreaterThan(0)
    expect(edges.every((edge) => edge.reviewStatus === 'pending')).toBe(true)
  })

  it('should keep mention writeback discriminator when the existing row already has one', async () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const personId = graphNodeIdForEntity(vaultId, 'person', '张三', '同事')
    const existing = {
      id: personId,
      vaultId,
      nodeType: 'person',
      name: '张三',
      aliases: ['张三'],
      summary: '',
      propsJson: '{}',
      mentionCount: 5,
      firstSeenAt: 1,
      lastSeenAt: 1,
      origin: 'ai',
      shardMonth: '2026-03',
      reviewStatus: 'approved',
      createdAt: 1,
      updatedAt: 10,
      deletedAt: null,
      discriminator: '同事'
    }
    let recounted = false
    const { service, writeRecord, recountMentions } = createService({
      findNodeByNameOrAlias: vi.fn(async () => existing),
      getNodeById: vi.fn(async (id: string) => {
        if (id !== personId) return null
        return recounted ? { ...existing, mentionCount: 3, updatedAt: 10 } : existing
      }),
      recountMentions: vi.fn(async () => {
        recounted = true
      }),
      llm: async () =>
        JSON.stringify({
          entities: [{ name: '张三', type: 'person', aliases: [], summary: '', confidence: 90 }],
          edges: []
        })
    })
    const draft = await service.extractDraft({
      vaultId,
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    expect(recountMentions).toHaveBeenCalled()
    const personWrites = writeRecord.mock.calls
      .map((call) => call[0] as { id?: string; discriminator?: string; mentionCount?: number })
      .filter((record) => record.id === personId)
    expect(personWrites.length).toBeGreaterThan(0)
    expect(personWrites.every((record) => record.discriminator === '同事')).toBe(true)
  })
})

describe('GraphLlmExtractionService commitDrafts embed count', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-extract-embed-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('should call embedQuery only once for the same new node during one commitDrafts', async () => {
    const vaultId = 'vlt_aaaaaaaaaaaaaaaa'
    const personId = graphNodeIdForEntity(vaultId, 'person', '小张')
    const personCard = graphNodeCardText('小张', '同事')
    const embedQuery = vi.fn(async (_text: string) => [1, 0])
    const freshness = new DerivedFreshnessService()
    freshness.bindPendingReextract({
      loadExtractHashes: async () => new Map(),
      listJournals: async () => [],
      writeExtractState: async () => undefined
    })
    const pathService = {
      getGraphBaseDirectory: async () => path.join(tmpDir, 'Graph'),
      getActiveVaultPath: async () => path.join(tmpDir, 'vault')
    }
    const graphManager = new GraphRawManager(pathService as never, new NodeFileSystem(), freshness)
    const applyRawNode = vi.fn(async (row: { id: string }) => ({ id: row.id }))
    const repo = {
      findNodeByNameOrAlias: vi.fn(async () => null),
      findNodesByNameOrAlias: vi.fn(async () => []),
      getNodeById: vi.fn(async () => null),
      searchNodesByVector: vi.fn(async () => []),
      recountMentions: vi.fn(async () => undefined),
      applyRawNode,
      applyRawEdge: vi.fn(async () => undefined),
      softDeleteNode: vi.fn(async () => undefined),
      softDeleteEdge: vi.fn(async () => undefined),
      listLiveNodeRefs: vi.fn(async () => []),
      listLiveEdgeRefs: vi.fn(async () => []),
      listNodeIds: vi.fn(async () => []),
      listEdgeIds: vi.fn(async () => [])
    }
    const service = new GraphLlmExtractionService(
      graphManager,
      freshness,
      repo as never,
      new GraphSyncService(graphManager, repo as never, { embedQuery, modelId: 'embed-v1' }),
      pathService as never,
      {
        exists: async () => true,
        readFile: async () => '今天和小张吃饭'
      } as never,
      async () =>
        JSON.stringify({
          entities: [
            { name: '小张', type: 'person', aliases: [], summary: '同事', confidence: 90 }
          ],
          edges: [
            { from: '小张', to: '2026-03-15', type: 'mentions', excerpt: '吃饭', confidence: 80 }
          ]
        }),
      { embedQuery, modelId: 'embed-v1' }
    )

    const draft = await service.extractDraft({
      vaultId,
      vaultName: 'Personal',
      filePath: FILE,
      contentHash: 'hash-1',
      selfName: '小明'
    })
    const results = await service.commitDrafts([draft])
    expect(results[0]?.error).toBeUndefined()
    const personEmbedCalls = embedQuery.mock.calls.filter((call) => call[0] === personCard)
    expect(personEmbedCalls).toHaveLength(1)
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: personId, embedding: [1, 0] })
    )
  })
})
