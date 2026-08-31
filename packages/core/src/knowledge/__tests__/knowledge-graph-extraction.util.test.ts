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
          truncated: false
        })),
        replaceSourceGraph
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
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
    const syncPendingIndex = vi.fn(async () => undefined)
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

describe('KnowledgeGraphExtractionService source shards', () => {
  it('每个窗口整文件替换后 supersede SQLite，最后 index', async () => {
    const order: string[] = []
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => null),
        replaceSourceGraph: vi.fn(async () => {
          order.push('replace')
        })
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => {
          order.push('supersede')
          return 1
        })
      } as never,
      index: {
        syncPendingIndex: vi.fn(async () => {
          order.push('index')
        })
      } as never,
      llm: async () =>
        JSON.stringify({
          entities: [{ name: '甲', type: 'person' }],
          edges: [{ from: '甲', to: '资料', type: 'mentions' }]
        }),
      getVaultName: () => 'Personal'
    })

    await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: '甲和资料有关',
      textHash: 'h1'
    })
    expect(order).toEqual(['replace', 'supersede', 'index'])
  })

  it('写入分片键是 sourceId，不继承其他资料的 shardMonth', async () => {
    const shards: string[] = []
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => null),
        replaceSourceGraph: vi.fn(async (input: { nodes: Array<{ shardMonth: string }> }) => {
          shards.push(...input.nodes.map((n) => n.shardMonth))
        })
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => ({
          id: 'old',
          shardMonth: 'src_other',
          mentionCount: 3,
          aliases: '[]',
          name: '小明',
          summary: '',
          firstSeenAt: 1,
          createdAt: 1
        })),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm: async () =>
        JSON.stringify({
          entities: [{ name: '小明', type: 'person' }],
          edges: []
        }),
      getVaultName: () => 'Personal'
    })

    await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src5',
      sourceTitle: '资料',
      text: '小明出现了',
      textHash: 'h-shard'
    })
    expect(shards.length).toBeGreaterThan(0)
    expect(shards.every((key) => key === 'src5')).toBe(true)
  })

  it('两窗抽同一人时复用节点并累加 mention', async () => {
    const writes: Array<{ id: string; mentionCount: number; aliases: string[] }> = []
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => null),
        replaceSourceGraph: vi.fn(
          async (input: {
            nodes: Array<{ id: string; nodeType?: string; mentionCount: number; aliases: string[] }>
          }) => {
            for (const record of input.nodes) {
              if (record.nodeType === 'person') writes.push(record)
            }
          }
        )
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm: async () =>
        JSON.stringify({
          entities: [{ name: '小明', type: 'person', aliases: ['明明'] }],
          edges: []
        }),
      getVaultName: () => 'Personal'
    })

    await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: `${'甲'.repeat(5000)}${'乙'.repeat(5000)}`,
      textHash: 'h-mention'
    })
    expect(writes.length).toBeGreaterThanOrEqual(2)
    expect(writes[writes.length - 1]!.mentionCount).toBeGreaterThanOrEqual(2)
    expect(writes[writes.length - 1]!.aliases).toEqual(expect.arrayContaining(['小明', '明明']))
  })

  it('解析失败不推进 windowsDone', async () => {
    const states: number[] = []
    let calls = 0
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => null),
        replaceSourceGraph: vi.fn(async (input: { extractState: { windowsDone: number } }) => {
          states.push(input.extractState.windowsDone)
        })
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm: async () => {
        calls += 1
        return calls === 1 ? 'not-json' : JSON.stringify({ entities: [{ name: '甲', type: 'person' }], edges: [] })
      },
      getVaultName: () => 'Personal'
    })

    const result = await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: `${'甲'.repeat(5000)}${'乙'.repeat(5000)}`,
      textHash: 'h-parse'
    })
    expect(result.windows).toBe(1)
    expect(states.at(-1)).toBe(1)
  })

  it('全窗解析失败仍写 extract-state，且 windowsDone 等于总数', async () => {
    const states: Array<{ windowsDone: number; windowsTotal: number }> = []
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => null),
        replaceSourceGraph: vi.fn(async (input: { extractState: { windowsDone: number; windowsTotal: number } }) => {
          states.push(input.extractState)
        })
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm: async () => 'not-json',
      getVaultName: () => 'Personal'
    })

    const result = await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: '短文本一窗',
      textHash: 'h-all-fail'
    })
    expect(result.windows).toBe(0)
    expect(states).toEqual([expect.objectContaining({ windowsDone: 1, windowsTotal: 1 })])
  })

  it('把 0-1 把握换成 0-100，避免整图变成待确认虚线', async () => {
    const reviews: Array<{ reviewStatus: string; confidence?: number }> = []
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => null),
        replaceSourceGraph: vi.fn(
          async (input: {
            nodes: Array<{ nodeType?: string; reviewStatus: string }>
            edges: Array<{ reviewStatus: string; confidence?: number }>
          }) => {
            for (const node of input.nodes) {
              if (node.nodeType === 'person') reviews.push(node)
            }
            reviews.push(...input.edges)
          }
        )
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm: async () =>
        JSON.stringify({
          entities: [{ name: '甲', type: 'person', confidence: 0.86 }],
          edges: [{ from: '甲', to: '资料', type: 'mentions', confidence: 0.9 }]
        }),
      getVaultName: () => 'Personal'
    })

    await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: '甲和资料有关',
      textHash: 'h-conf'
    })
    expect(reviews.some((row) => row.reviewStatus === 'pending')).toBe(false)
    expect(reviews.some((row) => row.confidence === 90)).toBe(true)
  })
})
