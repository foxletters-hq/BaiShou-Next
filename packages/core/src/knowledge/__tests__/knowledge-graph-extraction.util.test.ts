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
        findNodesByNameOrAlias: vi.fn(async () => []),
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
    expect(order.at(-2)).toBe('supersede')
    expect(order.at(-1)).toBe('index')
    expect(order.filter((step) => step === 'replace').length).toBeGreaterThanOrEqual(1)
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
        findNodesByNameOrAlias: vi.fn(async () => [
          {
            id: 'old',
            shardMonth: 'src_other',
            mentionCount: 3,
            aliases: '[]',
            name: '小明',
            summary: '',
            firstSeenAt: 1,
            createdAt: 1
          }
        ]),
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
        findNodesByNameOrAlias: vi.fn(async () => []),
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
    expect(writes).toHaveLength(1)
    expect(writes[0]!.mentionCount).toBeGreaterThanOrEqual(2)
    expect(writes[writes.length - 1]!.aliases).toEqual(expect.arrayContaining(['小明', '明明']))
  })

  it('should report the current window before the model returns so the UI can advance', async () => {
    const progress: Array<{ windowsDone: number; windowsTotal: number }> = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => null),
        replaceSourceGraph: vi.fn(async () => undefined)
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        findNodesByNameOrAlias: vi.fn(async () => []),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm: async () => {
        await gate
        return JSON.stringify({ entities: [{ name: '甲', type: 'person' }], edges: [] })
      },
      getVaultName: () => 'Personal'
    })

    const run = service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: `${'甲'.repeat(5000)}${'乙'.repeat(5000)}`,
      textHash: 'h-live',
      onProgress: (info) => progress.push(info)
    })

    await vi.waitFor(() => {
      expect(progress.some((row) => row.windowsDone >= 1 && row.windowsTotal >= 1)).toBe(true)
    })
    release()
    await run
  })

  it('should skip a timed-out window and keep extracting later windows', async () => {
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
        findNodesByNameOrAlias: vi.fn(async () => []),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm: async () => {
        calls += 1
        if (calls === 1) throw new Error('graph-extract-window-timeout')
        return JSON.stringify({ entities: [{ name: '乙', type: 'person' }], edges: [] })
      },
      getVaultName: () => 'Personal'
    })

    const result = await service.extractSource({
      vaultId: 'v1',
      notebookId: 'nb1',
      sourceId: 'src1',
      sourceTitle: '资料',
      text: `${'甲'.repeat(5000)}${'乙'.repeat(5000)}`,
      textHash: 'h-timeout-skip'
    })
    expect(result.windows).toBe(1)
    expect(calls).toBe(2)
    expect(states.at(-1)).toBe(2)
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
        findNodesByNameOrAlias: vi.fn(async () => []),
        supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
      } as never,
      index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
      llm: async () => {
        calls += 1
        return calls === 1
          ? 'not-json'
          : JSON.stringify({ entities: [{ name: '甲', type: 'person' }], edges: [] })
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
    expect(states).toContain(1)
    expect(states.at(-1)).toBe(2)
  })

  it('全窗解析失败仍写 extract-state，且 windowsDone 等于总数', async () => {
    const states: Array<{ windowsDone: number; windowsTotal: number }> = []
    const service = new KnowledgeGraphExtractionService({
      raw: {
        getExtractState: vi.fn(async () => null),
        replaceSourceGraph: vi.fn(
          async (input: { extractState: { windowsDone: number; windowsTotal: number } }) => {
            states.push(input.extractState)
          }
        )
      } as never,
      repo: {
        findNodeByName: vi.fn(async () => null),
        findNodesByNameOrAlias: vi.fn(async () => []),
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
    expect(states).toEqual([
      expect.objectContaining({ windowsDone: 1, windowsTotal: 1, alignWritten: true })
    ])
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
        findNodesByNameOrAlias: vi.fn(async () => []),
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
})
