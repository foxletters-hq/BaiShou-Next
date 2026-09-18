import { describe, expect, it, vi } from 'vitest'
import { listAmbiguousSourceRefs, notebookGraphNodeIdForEntity } from '@baishou/shared'
import { KnowledgeGraphExtractionService } from '../knowledge-graph-extraction.service'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'
const NB_THIS = 'nb-this'
const NB_OTHER = 'nb-other'

function personId(notebookId: string, name: string): string {
  return notebookGraphNodeIdForEntity(VAULT, notebookId, 'person', name)
}

function extractJson(name = '小张', summary = '同事') {
  return JSON.stringify({
    entities: [{ name, type: 'person', aliases: [], summary, confidence: 90 }],
    edges: []
  })
}

function createService(overrides?: {
  llm?: (input: { system: string; user: string }) => Promise<string | null>
  findNodeByName?: (
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ) => Promise<unknown>
  findNodesByNameOrAlias?: (
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ) => Promise<unknown[]>
  searchNodesByVector?: ReturnType<typeof vi.fn>
  updateNodeEmbedding?: ReturnType<typeof vi.fn>
  embedQuery?: (text: string) => Promise<number[] | null>
  modelId?: string
  captureEdges?: boolean
}) {
  const nodes: Array<Record<string, unknown>> = []
  const edges: Array<Record<string, unknown>> = []
  const findNodeByName = vi.fn(
    overrides?.findNodeByName ?? (async () => null)
  )
  const findNodesByNameOrAlias = vi.fn(
    overrides?.findNodesByNameOrAlias ??
      (async (vaultId: string, notebookId: string, name: string, nodeType?: string) => {
        const one = await findNodeByName(vaultId, notebookId, name, nodeType)
        return one ? [one] : []
      })
  )
  const searchNodesByVector = overrides?.searchNodesByVector ?? vi.fn(async () => [])
  const updateNodeEmbedding = overrides?.updateNodeEmbedding ?? vi.fn(async () => undefined)
  const service = new KnowledgeGraphExtractionService({
    raw: {
      getExtractState: vi.fn(async () => null),
      replaceSourceGraph: vi.fn(
        async (input: { nodes: Array<Record<string, unknown>>; edges?: Array<Record<string, unknown>> }) => {
          nodes.length = 0
          edges.length = 0
          for (const record of input.nodes) {
            if (record.nodeType === 'person') nodes.push(record)
          }
          if (overrides?.captureEdges && input.edges) {
            edges.push(...input.edges)
          }
        }
      )
    } as never,
    repo: {
      findNodeByName,
      findNodesByNameOrAlias,
      searchNodesByVector,
      updateNodeEmbedding,
      supersedeAiEdgesBySourcePrefix: vi.fn(async () => 0)
    } as never,
    index: { syncPendingIndex: vi.fn(async () => undefined) } as never,
    llm: overrides?.llm ?? (async () => extractJson()),
    getVaultName: () => 'Personal',
    align:
      overrides?.embedQuery || overrides?.modelId
        ? { embedQuery: overrides.embedQuery, modelId: overrides.modelId ?? 'embed-v1' }
        : undefined
  })
  return {
    service,
    nodes,
    edges,
    findNodeByName,
    findNodesByNameOrAlias,
    searchNodesByVector,
    updateNodeEmbedding
  }
}

async function extractIn(service: KnowledgeGraphExtractionService, notebookId: string) {
  return service.extractSource({
    vaultId: VAULT,
    notebookId,
    sourceId: 'src1',
    sourceTitle: '资料',
    text: '小张出现了',
    textHash: 'h-align'
  })
}

describe('KnowledgeGraphExtractionService entity align', () => {
  it('should keep same-name entities in different notebooks as separate nodes', async () => {
    const otherId = personId(NB_OTHER, '张三')
    const { service, nodes, findNodeByName, searchNodesByVector } = createService({
      llm: async () => extractJson('张三', '同事'),
      embedQuery: async () => [1, 0],
      findNodeByName: vi.fn(async (_vault: string, notebookId: string, name: string) => {
        if (notebookId === NB_OTHER && name === '张三') {
          return { id: otherId, name: '张三', aliases: '[]', summary: '别的本' }
        }
        return null
      }),
      searchNodesByVector: vi.fn(async (_vault: string, notebookId: string) => {
        if (notebookId === NB_OTHER) {
          return [
            {
              id: otherId,
              name: '张三',
              aliases: '[]',
              summary: '别的本',
              nodeType: 'person',
              distance: 0.1
            }
          ]
        }
        return []
      })
    })

    await extractIn(service, NB_THIS)

    expect(nodes[0]?.id).toBe(personId(NB_THIS, '张三'))
    expect(nodes[0]?.id).not.toBe(otherId)
    expect(findNodeByName.mock.calls.every((call) => call[1] === NB_THIS)).toBe(true)
    expect(searchNodesByVector.mock.calls.every((call) => call[1] === NB_THIS)).toBe(true)
    expect(nodes[0]).not.toHaveProperty('embedding')
  })

  it('should reuse the existing node when the same notebook hits by name', async () => {
    const existingId = personId(NB_THIS, '张三')
    const embedQuery = vi.fn(async () => [1, 0])
    const { service, nodes, searchNodesByVector } = createService({
      llm: async () => extractJson('张三', '同事'),
      embedQuery,
      findNodeByName: vi.fn(async (_vault: string, notebookId: string, name: string) => {
        if (notebookId === NB_THIS && name === '张三') {
          return {
            id: existingId,
            name: '张三',
            aliases: '["三哥"]',
            summary: '同事',
            mentionCount: 2,
            firstSeenAt: 1,
            createdAt: 1
          }
        }
        return null
      })
    })

    await extractIn(service, NB_THIS)

    expect(nodes[0]?.id).toBe(existingId)
    expect(nodes[0]?.aliases).toEqual(expect.arrayContaining(['张三', '三哥']))
    expect(embedQuery).not.toHaveBeenCalled()
    expect(searchNodesByVector).not.toHaveBeenCalled()
  })

  it('should merge onto the recalled node when the second model says they are the same', async () => {
    const existingId = personId(NB_THIS, '张三')
    const llm = vi.fn(async (input: { system: string; user: string }) => {
      if (input.system.includes('实体对齐')) {
        return JSON.stringify({ merges: [{ incoming: 'i1', existing: 'e1' }] })
      }
      return extractJson('小张', '同事')
    })
    const { service, nodes } = createService({
      llm,
      embedQuery: async () => [1, 0],
      searchNodesByVector: vi.fn(async (_vault: string, notebookId: string) => {
        if (notebookId !== NB_THIS) return []
        return [
          {
            id: existingId,
            name: '张三',
            aliases: '["三哥"]',
            summary: '同事',
            nodeType: 'person',
            distance: 0.35
          }
        ]
      })
    })

    await extractIn(service, NB_THIS)

    expect(llm.mock.calls.some((call) => call[0].system.includes('实体对齐'))).toBe(true)
    expect(nodes[0]?.id).toBe(existingId)
    expect(nodes[0]?.name).toBe('张三')
    expect(nodes[0]?.aliases).toEqual(expect.arrayContaining(['小张', '三哥']))
  })

  it('should create a new node when the second model refuses to merge a vector hit', async () => {
    const existingId = personId(NB_THIS, '张三')
    const llm = vi.fn(async (input: { system: string; user: string }) => {
      if (input.system.includes('实体对齐')) {
        return JSON.stringify({ merges: [] })
      }
      return extractJson('小张', '同事')
    })
    const { service, nodes } = createService({
      llm,
      embedQuery: async () => [1, 0],
      searchNodesByVector: vi.fn(async () => [
        {
          id: existingId,
          name: '张三',
          aliases: '[]',
          summary: '另一个人',
          nodeType: 'person',
          distance: 0.35
        }
      ])
    })

    await extractIn(service, NB_THIS)

    expect(nodes[0]?.id).toBe(personId(NB_THIS, '小张'))
    expect(nodes[0]?.id).not.toBe(existingId)
  })

  it('should fall back to name-only merge when embedding is not configured', async () => {
    const existingId = personId(NB_THIS, '张三')
    const { service, nodes, searchNodesByVector, updateNodeEmbedding } = createService({
      llm: async () => extractJson('张三', '同事'),
      findNodeByName: vi.fn(async (_vault: string, notebookId: string, name: string) => {
        if (notebookId === NB_THIS && name === '张三') {
          return { id: existingId, name: '张三', aliases: '[]', summary: '同事' }
        }
        return null
      })
    })

    await expect(extractIn(service, NB_THIS)).resolves.toEqual(
      expect.objectContaining({ windows: 1 })
    )
    expect(nodes[0]?.id).toBe(existingId)
    expect(searchNodesByVector).not.toHaveBeenCalled()
    expect(updateNodeEmbedding).not.toHaveBeenCalled()
  })

  it('should not write the incoming vector when the merged node card changed', async () => {
    const existingId = personId(NB_THIS, '张三')
    const llm = vi.fn(async (input: { system: string; user: string }) => {
      if (input.system.includes('实体对齐')) {
        return JSON.stringify({ merges: [{ incoming: 'i1', existing: 'e1' }] })
      }
      return extractJson('小张', '同事')
    })
    const { service, updateNodeEmbedding } = createService({
      llm,
      embedQuery: async () => [1, 0],
      modelId: 'embed-v1',
      findNodeByName: vi.fn(async (_vault: string, notebookId: string, name: string) => {
        if (notebookId === NB_THIS && name === '张三') {
          return {
            id: existingId,
            name: '张三',
            aliases: '["三哥"]',
            summary: '老朋友'
          }
        }
        return null
      }),
      searchNodesByVector: vi.fn(async () => [
        {
          id: existingId,
          name: '张三',
          aliases: '["三哥"]',
          summary: '老朋友',
          nodeType: 'person',
          distance: 0.35
        }
      ])
    })

    await extractIn(service, NB_THIS)

    expect(updateNodeEmbedding).not.toHaveBeenCalled()
  })

  it('should persist the alignment vector for a newly created node', async () => {
    const createdId = personId(NB_THIS, '小张')
    const { service, nodes, updateNodeEmbedding } = createService({
      embedQuery: async () => [1, 0],
      modelId: 'embed-v1'
    })

    await extractIn(service, NB_THIS)

    expect(nodes[0]?.id).toBe(createdId)
    expect(nodes[0]).not.toHaveProperty('embedding')
    expect(updateNodeEmbedding).toHaveBeenCalledWith(createdId, VAULT, NB_THIS, [1, 0], 'embed-v1')
  })

  it('should keep ambiguous false when notebook name lookup returns one row', async () => {
    const existingId = personId(NB_THIS, '张三')
    const { service, nodes } = createService({
      llm: async () => extractJson('张三', '同事'),
      findNodeByName: vi.fn(async (_vault: string, notebookId: string, name: string) => {
        if (notebookId === NB_THIS && name === '张三') {
          return { id: existingId, name: '张三', aliases: '[]', summary: '同事', discriminator: '' }
        }
        return null
      })
    })

    await extractIn(service, NB_THIS)

    expect(nodes[0]?.id).toBe(existingId)
    expect(nodes[0]?.discriminator).toBe('')
    expect(listAmbiguousSourceRefs((nodes[0]?.props as Record<string, unknown>) ?? {})).toEqual([])
  })

  it('should hang the edge on the bare-name node and mark it pending when name lookup returns two rows', async () => {
    const bareId = personId(NB_THIS, '张三')
    const splitId = notebookGraphNodeIdForEntity(VAULT, NB_THIS, 'person', '张三', '同事')
    const judgeMerges = vi.fn()
    const llm = vi.fn(async (input: { system: string; user: string }) => {
      if (input.system.includes('实体对齐')) {
        judgeMerges()
        throw new Error('多候选时不应再调二次判定')
      }
      return JSON.stringify({
        entities: [{ name: '张三', type: 'person', aliases: [], summary: '资料里的张三', confidence: 90 }],
        edges: [{ from: '张三', to: '资料', type: 'mentions', excerpt: '出现了', confidence: 90 }]
      })
    })
    const { service, nodes, edges } = createService({
      llm,
      captureEdges: true,
      findNodesByNameOrAlias: vi.fn(async (_vault: string, notebookId: string, name: string) => {
        if (notebookId !== NB_THIS || name !== '张三') return []
        return [
          {
            id: bareId,
            name: '张三',
            aliases: '["张三"]',
            summary: '第一个',
            discriminator: '',
            propsJson: JSON.stringify({
              nameRegistry: [
                { discriminator: '同事', label: '同事', nodeId: splitId, registeredAt: 1 }
              ]
            }),
            mentionCount: 1,
            firstSeenAt: 1,
            createdAt: 1
          },
          {
            id: splitId,
            name: '张三',
            aliases: '["张三"]',
            summary: '同事',
            discriminator: '同事',
            propsJson: '{}',
            mentionCount: 1,
            firstSeenAt: 1,
            createdAt: 1
          }
        ]
      })
    })

    await extractIn(service, NB_THIS)

    expect(judgeMerges).not.toHaveBeenCalled()
    expect(nodes[0]?.id).toBe(bareId)
    expect(nodes[0]?.id).not.toBe(splitId)
    expect(nodes[0]?.discriminator).toBe('')
    expect(listAmbiguousSourceRefs((nodes[0]?.props as Record<string, unknown>) ?? {})).toEqual([
      'src1#0'
    ])
    expect(edges[0]).toEqual(
      expect.objectContaining({
        fromId: bareId,
        reviewStatus: 'pending'
      })
    )
  })

  it('should keep the existing discriminator when rewriting a notebook split node', async () => {
    const splitId = notebookGraphNodeIdForEntity(VAULT, NB_THIS, 'person', '张三', '同事')
    const { service, nodes } = createService({
      llm: async () => extractJson('张三', '同事'),
      findNodeByName: vi.fn(async (_vault: string, notebookId: string, name: string) => {
        if (notebookId === NB_THIS && name === '张三') {
          return {
            id: splitId,
            name: '张三',
            aliases: '[]',
            summary: '同事',
            discriminator: '同事',
            propsJson: '{"keep":true}',
            mentionCount: 2,
            firstSeenAt: 1,
            createdAt: 1
          }
        }
        return null
      })
    })

    await extractIn(service, NB_THIS)

    expect(nodes[0]?.id).toBe(splitId)
    expect(nodes[0]?.discriminator).toBe('同事')
  })
})
