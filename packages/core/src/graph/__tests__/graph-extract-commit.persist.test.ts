import { describe, expect, it, vi } from 'vitest'
import {
  entryNodeIdForFilePath,
  graphNodeCardText,
  graphNodeIdForEntity,
  legacyEntryNodeIdForFilePath
} from '@baishou/shared'
import { FILE, createService, precomputedFromSync } from './graph-extract-commit.test-helpers'

describe('GraphLlmExtractionService draft/commit', () => {
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
          distance: 0.25
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
