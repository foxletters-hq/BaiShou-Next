import { describe, expect, it, vi } from 'vitest'
import {
  KnowledgeGraphExtractionService,
  shouldSupersedeNotebookAiEdges
} from '../knowledge-graph-extraction.service'

describe('shouldSupersedeNotebookAiEdges', () => {
  it('抽空不得 supersede', () => {
    expect(shouldSupersedeNotebookAiEdges(new Set())).toBe(false)
  })

  it('有成功写出的边才 supersede', () => {
    expect(shouldSupersedeNotebookAiEdges(new Set(['e1']))).toBe(true)
  })
})

describe('KnowledgeGraphExtractionService force re-extract', () => {
  it('正文未变且未 force 时跳过', async () => {
    const llm = vi.fn()
    const replaceSourceGraph = vi.fn()
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => ({
          extractedTextHash: 'h1',
          windowsDone: 1,
          windowsTotal: 1,
          truncated: false,
          alignWritten: true
        })),
        replaceSourceGraph
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        findNodesByNameOrAlias: vi.fn(async () => []),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm,
      getVaultName: () => 'Personal'
    })
    const result = await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: '甲和资料有关',
      textHash: 'h1'
    })
    expect(result.skipped).toBe('unchanged')
    expect(llm).not.toHaveBeenCalled()
    expect(replaceSourceGraph).not.toHaveBeenCalled()
  })

  it('force 时先按资料删分片再重抽', async () => {
    const llm = vi.fn(async () =>
      JSON.stringify({
        entities: [{ name: '甲', type: 'person' }],
        edges: [{ from: '甲', to: '资料', type: 'mentions' }]
      })
    )
    const deleteSourceShards = vi.fn(async () => undefined)
    const syncPendingIndex = vi.fn(async (_opts?: Record<string, unknown>) => undefined)
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => ({
          extractedTextHash: 'h1',
          windowsDone: 1,
          windowsTotal: 1,
          truncated: false
        })),
        deleteSourceShards,
        replaceSourceGraph: vi.fn(async () => undefined)
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        findNodesByNameOrAlias: vi.fn(async () => []),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex } as never,
      llm,
      getVaultName: () => 'Personal'
    })
    const result = await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: '甲和资料有关',
      textHash: 'h1',
      force: true
    })
    expect(result.skipped).toBeUndefined()
    expect(deleteSourceShards).toHaveBeenCalledWith('nb1', 'src1')
    expect(syncPendingIndex.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        vaultId: 'v1',
        notebookId: 'nb1',
        deletedShardPaths: [
          'Notebooks/nb1/graph/nodes/src1.jsonl',
          'Notebooks/nb1/graph/edges/src1.jsonl'
        ]
      })
    )
    expect(llm).toHaveBeenCalled()
  })
})
