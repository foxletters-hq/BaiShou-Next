import { describe, expect, it, vi } from 'vitest'
import { graphNodeIdForEntity } from '@baishou/shared'
import { alignEntityPool, parseEntityAlignDecisions } from '../graph-entity-align'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'

describe('alignEntityPool', () => {
  it('reuses exact name hits before calling embed or the judge', async () => {
    const embedQuery = vi.fn()
    const judgeMerges = vi.fn()
    const existingId = graphNodeIdForEntity(VAULT, 'person', '小明')
    const out = await alignEntityPool(
      [{ name: '小明', nodeType: 'person', summary: '同学' }],
      {
        findByNameOrAlias: async () => ({
          id: existingId,
          name: '小明',
          aliases: ['小明同学']
        }),
        embedQuery,
        judgeMerges,
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
      }
    )
    expect(out.get('person\0小明')?.id).toBe(existingId)
    expect(out.get('person\0小明')?.mergedBy).toBe('name')
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
        findByNameOrAlias: async () => null,
        embedQuery: async () => [1, 0],
        searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name)
      }
    )
    expect(out.get('person\0小张')?.mergedBy).toBe('create')
    expect(out.get('person\0张三')?.mergedBy).toBe('create')
    expect(out.get('person\0小张')?.id).not.toBe(dbId)
    expect(out.get('person\0张三')?.id).toBe(graphNodeIdForEntity(VAULT, 'person', '张三'))
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
        findByNameOrAlias: async () => null,
        embedQuery: async () => [1, 0],
        searchByVector: async () => [
          { id: dbId, name: '张三', aliases: ['三哥'], nodeType: 'person', distance: 0.35 }
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
    expect(out.get('person\0小张')?.aliases).toEqual(expect.arrayContaining(['小张', '张三丰', '三哥']))
  })

  it('does not recall a 50% vector hit for the judge', async () => {
    const judgeMerges = vi.fn().mockResolvedValue([])
    await alignEntityPool(
      [
        { name: '杭州', nodeType: 'place', summary: '城市' },
        { name: '西湖', nodeType: 'place', summary: '景点' }
      ],
      {
        findByNameOrAlias: async () => null,
        embedQuery: async () => [1, 0],
        searchByVector: async () => [
          { id: 'other', name: '上海', aliases: [], nodeType: 'place', distance: 0.5 }
        ],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges
      }
    )
    expect(judgeMerges).toHaveBeenCalledWith(expect.objectContaining({ existing: [] }))
  })

  it('creates a new node when the judge leaves a close vector hit out of merges', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const out = await alignEntityPool(
      [{ name: '小张', nodeType: 'person', summary: '同事' }],
      {
        findByNameOrAlias: async () => null,
        embedQuery: async () => [1, 0],
        searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges: async () => []
      }
    )
    expect(out.get('person\0小张')?.mergedBy).toBe('create')
    expect(out.get('person\0小张')?.id).toBe(graphNodeIdForEntity(VAULT, 'person', '小张'))
    expect(out.get('person\0小张')?.id).not.toBe(dbId)
  })

  it('creates new nodes when the judge returns null instead of hard-merging', async () => {
    const dbId = graphNodeIdForEntity(VAULT, 'person', '张三')
    const out = await alignEntityPool(
      [
        { name: '小张', nodeType: 'person', summary: '同事' },
        { name: '张三', nodeType: 'person', summary: '同事张三' }
      ],
      {
        findByNameOrAlias: async () => null,
        embedQuery: async () => [1, 0],
        searchByVector: async () => [{ id: dbId, name: '张三', aliases: [], distance: 0.12 }],
        nodeIdForEntity: (type, name) => graphNodeIdForEntity(VAULT, type, name),
        judgeMerges: async () => null
      }
    )
    expect(out.get('person\0小张')?.mergedBy).toBe('create')
    expect(out.get('person\0张三')?.mergedBy).toBe('create')
    expect(out.get('person\0小张')?.id).not.toBe(dbId)
  })
})

describe('parseEntityAlignDecisions', () => {
  it('reads incoming/existing/same_as from the second-pass JSON', () => {
    const parsed = parseEntityAlignDecisions(
      '```json\n{"merges":[{"incoming":"i1","existing":"e1"},{"incoming":"i2","same_as":"i1"}]}\n```'
    )
    expect(parsed).toEqual([
      { incomingRef: 'i1', existingRef: 'e1', sameAsIncomingRef: undefined },
      { incomingRef: 'i2', existingRef: undefined, sameAsIncomingRef: 'i1' }
    ])
  })

  it('returns null for extract-shaped JSON so commit creates new nodes', () => {
    expect(
      parseEntityAlignDecisions(
        JSON.stringify({
          entities: [{ name: '小张', type: 'person' }],
          edges: []
        })
      )
    ).toBeNull()
  })
})
