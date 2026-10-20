import { describe, expect, it, vi } from 'vitest'
import { graphNodeCardText } from '@baishou/shared'
import {
  NB_OTHER,
  NB_THIS,
  VAULT,
  createService,
  extractIn,
  extractJson,
  personId
} from './knowledge-graph-extraction-align.test-helpers'

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
            distance: 0.25
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
          distance: 0.25
        }
      ])
    })

    await extractIn(service, NB_THIS)

    expect(nodes[0]?.id).toBe(personId(NB_THIS, '小张'))
    expect(nodes[0]?.id).not.toBe(existingId)
    expect((nodes[0]?.props as Record<string, unknown> | undefined)?.similarPending).toBeUndefined()
  })

  it('should write similarPending when the align model is uncertain', async () => {
    const existingId = personId(NB_THIS, '张三')
    const llm = vi.fn(async (input: { system: string; user: string }) => {
      if (input.system.includes('实体对齐')) {
        expect(input.user).toContain('小张出现了')
        expect(input.user).toContain('sourceContext')
        return JSON.stringify({
          merges: [],
          uncertain: [
            { incoming: 'i1', existing: 'e1', reason: '像同一个人但不敢并', similarity: 0.72 }
          ]
        })
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
          distance: 0.25
        }
      ])
    })

    await extractIn(service, NB_THIS)

    expect(nodes[0]?.id).toBe(personId(NB_THIS, '小张'))
    expect(nodes[0]?.id).not.toBe(existingId)
    expect(nodes[0]?.reviewStatus).not.toBe('pending')
    expect((nodes[0]?.props as Record<string, unknown>).similarPending).toEqual(
      expect.objectContaining({
        peerId: existingId,
        similarity: 0.75,
        reason: '像同一个人但不敢并'
      })
    )
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

  it('should write a new embedding when extract overwrites the existing summary', async () => {
    const existingId = personId(NB_THIS, '张三')
    const embedQuery = vi.fn(async (text: string) => {
      if (text === graphNodeCardText('张三', '大学同学')) return [0, 1]
      return [1, 0]
    })
    const { service, nodes, updateNodeEmbedding } = createService({
      llm: async () => extractJson('张三', '大学同学'),
      embedQuery,
      modelId: 'embed-v1',
      findNodeByName: vi.fn(async (_vault: string, notebookId: string, name: string) => {
        if (notebookId === NB_THIS && name === '张三') {
          return {
            id: existingId,
            name: '张三',
            aliases: '[]',
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
    expect(nodes[0]?.summary).toBe('大学同学')
    expect(nodes[0]).not.toHaveProperty('embedding')
    expect(embedQuery).toHaveBeenCalledWith(graphNodeCardText('张三', '大学同学'))
    expect(updateNodeEmbedding).toHaveBeenCalledWith(existingId, VAULT, NB_THIS, [0, 1], 'embed-v1')
  })
})
