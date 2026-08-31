import { describe, expect, it, vi } from 'vitest'
import {
  GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR,
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  GRAPH_EXTRACT_EMPTY_RESPONSE_ERROR,
  entryNodeIdForFilePath,
  graphNodeIdForEntity,
  legacyEntryNodeIdForFilePath
} from '@baishou/shared'
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
  findNodeByNameOrAlias?: ReturnType<typeof vi.fn>
  recountMentions?: ReturnType<typeof vi.fn>
}) {
  const writeRecord = overrides?.writeRecord ?? vi.fn(async () => undefined)
  const removeRecordsFromShard = overrides?.removeRecordsFromShard ?? vi.fn(async () => 0)
  const listEdgesTouching = overrides?.listEdgesTouching ?? vi.fn(async () => [])
  const syncPendingIndex = overrides?.syncPendingIndex ?? vi.fn(async () => undefined)
  const commitReextract = vi.fn(async () => undefined)
  const recountMentions = overrides?.recountMentions ?? vi.fn(async () => undefined)
  const getNodeById = overrides?.getNodeById ?? vi.fn(async () => null)
  const findNodeByNameOrAlias = overrides?.findNodeByNameOrAlias ?? vi.fn(async () => null)
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
          entities: [{ name: '小张', type: 'person', aliases: [], summary: '同事', confidence: 90 }],
          edges: [{ from: '小张', to: '2026-03-15', type: 'mentions', excerpt: '吃饭', confidence: 80 }]
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
        edges: [{ from: '小张', to: '2026-03-15', type: 'mentions', excerpt: '吃饭', confidence: 80 }]
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
          entities: [{ name: '小张', type: 'person', aliases: [], summary: '同事', confidence: 90 }],
          edges: [{ from: '小张', to: '2026-03-15', type: 'mentions', excerpt: '吃饭', confidence: 80 }]
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
    expect(remapped).toEqual(expect.objectContaining({ id: 'e-user', fromId: 'person-1', toId: entryId }))
    expect(removeRecordsFromShard).toHaveBeenCalledWith('nodes', '2026-03', [legacyId])
  })
})
