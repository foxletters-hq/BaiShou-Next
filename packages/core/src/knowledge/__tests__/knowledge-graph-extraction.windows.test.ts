import { describe, expect, it, vi } from 'vitest'
import { KnowledgeGraphExtractionService } from '../knowledge-graph-extraction.service'

describe('KnowledgeGraphExtractionService source shards', () => {
  it('缺 alignWritten 的老检查点不得跳过', async () => {
    const llm = vi.fn(async () =>
      JSON.stringify({
        entities: [{ name: '甲', type: 'person' }],
        edges: []
      })
    )
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => ({
          extractedTextHash: 'h1',
          windowsDone: 1,
          windowsTotal: 1,
          truncated: false
        })),
        replaceSourceGraph: vi.fn(async () => undefined)
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
    expect(result.skipped).toBeUndefined()
    expect(llm).toHaveBeenCalled()
  })

  it('should align both windows in one pool so window-2 aliases can match window-1 entities', async () => {
    const alignUsers: string[] = []
    let extractCalls = 0
    const writes: Array<{ id: string; aliases: string[] }> = []
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => null),
        replaceSourceGraph: vi.fn(
          async (input: { nodes: Array<{ id: string; aliases: string[]; nodeType?: string }> }) => {
            for (const node of input.nodes) {
              if (node.nodeType === 'person') writes.push(node)
            }
          }
        )
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        findNodesByNameOrAlias: vi.fn(async () => []),
        searchNodesByVector: vi.fn(async () => []),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm: async (input: { system: string; user: string }) => {
        if (input.system.includes('实体对齐')) {
          alignUsers.push(input.user)
          return JSON.stringify({ merges: [{ incoming: 'i2', same_as: 'i1' }] })
        }
        extractCalls += 1
        if (input.user.includes('WIN1')) {
          return JSON.stringify({
            entities: [{ name: '张三', type: 'person', aliases: ['小张'], summary: '同事' }],
            edges: []
          })
        }
        return JSON.stringify({
          entities: [{ name: '小张', type: 'person', summary: '同事小张' }],
          edges: []
        })
      },
      getVaultName: () => 'Personal',
      align: { embedQuery: async () => [1, 0], modelId: 'embed-v1' }
    })

    await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: `WIN1${'甲'.repeat(4996)}${'乙'.repeat(5000)}`,
      textHash: 'h-batch'
    })

    expect(extractCalls).toBe(2)
    expect(alignUsers).toHaveLength(1)
    expect(alignUsers[0]).toContain('张三')
    expect(alignUsers[0]).toContain('小张')
    expect(writes.at(-1)?.aliases).toEqual(expect.arrayContaining(['张三', '小张']))
    expect(new Set(writes.map((row) => row.id)).size).toBe(1)
  })

  it('should not re-call extract LLM for window 1 when resuming after window 1 extracted', async () => {
    const extractUsers: string[] = []
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => ({
          extractedTextHash: 'h-resume',
          windowsDone: 1,
          windowsTotal: 2,
          truncated: false,
          alignWritten: false,
          extractedWindows: [
            {
              index: 0,
              sourceRef: 'src1#0',
              entities: [{ name: '甲', type: 'person' }],
              edges: []
            }
          ]
        })),
        replaceSourceGraph: vi.fn(async () => undefined)
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        findNodesByNameOrAlias: vi.fn(async () => []),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm: async (input: { system: string; user: string }) => {
        if (input.system.includes('实体对齐') || input.system.includes('同名候选')) {
          return JSON.stringify({ merges: [] })
        }
        extractUsers.push(input.user)
        return JSON.stringify({
          entities: [{ name: '乙', type: 'person' }],
          edges: []
        })
      },
      getVaultName: () => 'Personal'
    })

    await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: `${'甲'.repeat(5000)}${'乙'.repeat(5000)}`,
      textHash: 'h-resume'
    })
    expect(extractUsers).toHaveLength(1)
    expect(extractUsers[0]?.startsWith('乙')).toBe(true)
  })

  it('should align and index a full window pool before extracting the next window', async () => {
    const order: string[] = []
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => null),
        replaceSourceGraph: vi.fn(async () => undefined)
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        findNodesByNameOrAlias: vi.fn(async () => []),
        searchNodesByVector: vi.fn(async () => []),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: {
        syncPendingIndex: vi.fn(async () => {
          order.push('sync')
        })
      } as never,
      llm: async (input: { system: string; user: string }) => {
        if (input.system.includes('实体对齐') || input.system.includes('同名候选')) {
          return JSON.stringify({ merges: [] })
        }
        if (input.user.includes('LAST')) {
          order.push('last')
          return JSON.stringify({ entities: [{ name: '乙', type: 'person' }], edges: [] })
        }
        return JSON.stringify({ entities: [{ name: '甲', type: 'person' }], edges: [] })
      },
      getVaultName: () => 'Personal',
      align: { embedQuery: async () => [1, 0], modelId: 'embed-v1' }
    })

    await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: `${'甲'.repeat(50000)}LAST${'乙'.repeat(4996)}`,
      textHash: 'h-pool'
    })

    expect(order.indexOf('sync')).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('sync')).toBeLessThan(order.indexOf('last'))
  })
})
