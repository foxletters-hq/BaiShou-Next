import { describe, expect, it, vi } from 'vitest'
import { graphNodeIdForEntity } from '@baishou/shared'
import { alignEntityPool } from '../graph-entity-align'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

describe('alignEntityPool', () => {
  it('reuses exact name hits before calling embed or the judge', async () => {
    const embedQuery = vi.fn()
    const judgeMerges = vi.fn()
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const out = await alignEntityPool([{ name: '小明', nodeType: 'person', summary: '同学' }], {
      findCandidatesByNameOrAlias: async () => [
        {
          id: existingId,
          name: '小明',
          aliases: ['小明同学']
        }
      ],
      embedQuery,
      judgeMerges,
      nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
    })
    expect(out.get('person\0小明')?.id).toBe(existingId)
    expect(out.get('person\0小明')?.mergedBy).toBe('name')
    expect(out.get('person\0小明')?.ambiguous).toBeFalsy()
    expect(out.get('person\0小明')?.embedding).toBeUndefined()
    expect(out.get('person\0小明')?.embedText).toBeUndefined()
    expect(embedQuery).not.toHaveBeenCalled()
    expect(judgeMerges).not.toHaveBeenCalled()
  })

  it('does not hard-merge similar names when the judge is missing', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const out = await alignEntityPool(
      [
        { name: '小张', nodeType: 'person', summary: '同事' },
        { name: '张三', nodeType: 'person', summary: '同事张三' }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => [1, 0],
        searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
      }
    )
    expect(out.get('person\0小张')?.mergedBy).toBe('create')
    expect(out.get('person\0张三')?.mergedBy).toBe('create')
    expect(out.get('person\0小张')?.id).not.toBe(dbId)
    expect(out.get('person\0张三')?.id).toBe(graphNodeIdForEntity(VAULT, 'person', '张三'))
    expect(out.get('person\0小张')?.embedding).toEqual([1, 0])
    expect(out.get('person\0小张')?.embedText).toBe('小张\n同事')
  })

  it('should pass clipped sourceContext to judgeMerges when the diary excerpt is present', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const longContext = `今天见到小张。${'甲'.repeat(900)}`
    const judgeMerges = vi.fn().mockResolvedValue({ merges: [], uncertain: [] })
    await alignEntityPool(
      [
        {
          name: '小张',
          nodeType: 'person',
          summary: '同事',
          sourceContext: longContext
        }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => [1, 0],
        searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges
      }
    )
    expect(judgeMerges).toHaveBeenCalledWith(
      expect.objectContaining({
        incoming: [
          expect.objectContaining({
            ref: 'i1',
            name: '小张',
            sourceContext: longContext.slice(0, 800)
          })
        ]
      })
    )
    expect(String(judgeMerges.mock.calls[0]?.[0]?.incoming?.[0]?.sourceContext ?? '').length).toBe(
      800
    )
  })

  it('should create a new node and attach similarPending when the judge returns uncertain', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const judgeMerges = vi.fn().mockResolvedValue({
      merges: [],
      uncertain: [
        {
          incomingRef: 'i1',
          existingRef: 'e1',
          reason: '像同一个人但又不敢并',
          similarity: 0.72
        }
      ]
    })
    const out = await alignEntityPool(
      [
        {
          name: '小张',
          nodeType: 'person',
          summary: '同事',
          sourceContext: '今天见到小张，有点像张三'
        }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => [1, 0],
        searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges
      }
    )
    const created = out.get('person\0小张')
    expect(created?.mergedBy).toBe('create')
    expect(created?.reused).toBe(false)
    expect(created?.id).toBe(graphNodeIdForEntity(VAULT, 'person', '小张'))
    expect(created?.id).not.toBe(dbId)
    expect(created?.similarPending).toEqual(
      expect.objectContaining({
        peerId: dbId,
        similarity: 0.88,
        reason: '像同一个人但又不敢并',
        sourceExcerpt: '今天见到小张，有点像张三'
      })
    )
    expect(created?.similarPending?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should keep the vector score when the judge invents a lower similarity', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const out = await alignEntityPool([{ name: '小张', nodeType: 'person', summary: '同事' }], {
      findCandidatesByNameOrAlias: async () => [],
      embedQuery: async () => [1, 0],
      searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
      nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
      judgeMerges: async () => ({
        merges: [],
        uncertain: [
          {
            incomingRef: 'i1',
            existingRef: 'e1',
            reason: '模型自己写了 40%',
            similarity: 0.4
          }
        ]
      })
    })
    expect(out.get('person\0小张')?.similarPending).toEqual(
      expect.objectContaining({
        peerId: dbId,
        similarity: 0.88
      })
    )
  })

  it('should not attach similarPending when the judge points at a node recalled for someone else', async () => {
    const zhangId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const wangId = graphNodeIdForEntity(VAULT, 'person', '王五')
    const out = await alignEntityPool(
      [
        { name: '小张', nodeType: 'person', summary: '同事' },
        { name: '李四', nodeType: 'person', summary: '同学' }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async (text) => (text.startsWith('小张') ? [1, 0] : [0, 1]),
        searchByVector: async (vector) =>
          vector[0] === 1
            ? [{ id: zhangId, name: '张三', aliases: [], nodeType: 'person', distance: 0.12 }]
            : [{ id: wangId, name: '王五', aliases: [], nodeType: 'person', distance: 0.15 }],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges: async () => ({
          merges: [],
          uncertain: [
            {
              incomingRef: 'i2',
              existingRef: 'e1',
              reason: '把李四对到张三',
              similarity: 0.9
            }
          ]
        })
      }
    )
    expect(out.get('person\0李四')?.similarPending).toBeUndefined()
    expect(out.get('person\0小张')?.similarPending).toBeUndefined()
  })

  it('lets a second LLM call merge incoming names onto an existing node', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const judgeMerges = vi.fn().mockResolvedValue([
      { incomingRef: 'i1', existingRef: 'e1' },
      { incomingRef: 'i2', sameAsIncomingRef: 'i1' }
    ])
    const out = await alignEntityPool(
      [
        { name: '小张', nodeType: 'person', summary: '同事' },
        { name: '张三丰', nodeType: 'person', summary: '同事小张' }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => [1, 0],
        searchByVector: async () => [
          { id: dbId, name: '张三', aliases: ['三哥'], nodeType: 'person', distance: 0.25 }
        ],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges
      }
    )
    expect(judgeMerges).toHaveBeenCalledWith(
      expect.objectContaining({
        incoming: expect.arrayContaining([
          expect.objectContaining({ ref: 'i1', name: '小张' }),
          expect.objectContaining({ ref: 'i2', name: '张三丰' })
        ]),
        existing: [expect.objectContaining({ ref: 'e1', name: '张三', id: dbId })]
      })
    )
    expect(out.get('person\0小张')?.id).toBe(dbId)
    expect(out.get('person\0张三丰')?.id).toBe(dbId)
    expect(out.get('person\0小张')?.mergedBy).toBe('llm')
    expect(out.get('person\0小张')?.aliases).toEqual(
      expect.arrayContaining(['小张', '张三丰', '三哥'])
    )
    expect(out.get('person\0小张')?.embedding).toEqual([1, 0])
    expect(out.get('person\0小张')?.embedText).toBe('小张\n同事')
  })

  it('does not recall a 70% vector hit for the judge', async () => {
    const judgeMerges = vi.fn().mockResolvedValue([])
    await alignEntityPool(
      [
        { name: '杭州', nodeType: 'place', summary: '城市' },
        { name: '西湖', nodeType: 'place', summary: '景点' }
      ],
      {
        findCandidatesByNameOrAlias: async () => [],
        embedQuery: async () => [1, 0],
        searchByVector: async () => [
          { id: 'other', name: '上海', aliases: [], nodeType: 'place', distance: 0.3 }
        ],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges
      }
    )
    expect(judgeMerges).toHaveBeenCalledWith(expect.objectContaining({ existing: [] }))
  })

  it('creates a new node when the judge leaves a close vector hit out of merges', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const out = await alignEntityPool([{ name: '小张', nodeType: 'person', summary: '同事' }], {
      findCandidatesByNameOrAlias: async () => [],
      embedQuery: async () => [1, 0],
      searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
      nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
      judgeMerges: async () => []
    })
    expect(out.get('person\0小张')?.mergedBy).toBe('create')
    expect(out.get('person\0小张')?.id).toBe(graphNodeIdForEntity(VAULT, 'person', '小张'))
    expect(out.get('person\0小张')?.id).not.toBe(dbId)
    expect(out.get('person\0小张')?.similarPending).toBeUndefined()
  })
})
