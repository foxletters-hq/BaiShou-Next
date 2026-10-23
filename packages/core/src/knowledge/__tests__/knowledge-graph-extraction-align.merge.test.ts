import { describe, expect, it, vi } from 'vitest'
import {
  graphNodeCardText,
  listAmbiguousSourceRefs,
  notebookGraphNodeIdForEntity
} from '@baishou/shared'
import {
  NB_THIS,
  VAULT,
  createService,
  extractIn,
  extractJson,
  personId
} from './knowledge-graph-extraction-align.test-helpers'

describe('KnowledgeGraphExtractionService entity align', () => {
  it('should not write the incoming vector when the merged node card changed', async () => {
    const existingId = personId(NB_THIS, '张三')
    const llm = vi.fn(async (input: { system: string; user: string }) => {
      if (input.system.includes('实体对齐')) {
        return JSON.stringify({ merges: [{ incoming: 'i1', existing: 'e1' }] })
      }
      return extractJson('小张', '同事')
    })
    const embedQuery = vi.fn(async (text: string) => {
      if (text === graphNodeCardText('张三', '同事')) return [0, 1]
      return [1, 0]
    })
    const { service, updateNodeEmbedding } = createService({
      llm,
      embedQuery,
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
          distance: 0.25
        }
      ])
    })

    await extractIn(service, NB_THIS)

    expect(updateNodeEmbedding).toHaveBeenCalledWith(existingId, VAULT, NB_THIS, [0, 1], 'embed-v1')
    expect(updateNodeEmbedding).not.toHaveBeenCalledWith(
      existingId,
      VAULT,
      NB_THIS,
      [1, 0],
      'embed-v1'
    )
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
        entities: [
          { name: '张三', type: 'person', aliases: [], summary: '资料里的张三', confidence: 90 }
        ],
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
