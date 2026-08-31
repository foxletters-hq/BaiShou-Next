import { describe, expect, it, vi } from 'vitest'
import { RecallRelationsTool } from '../recall-relations.tool'
import type { ToolContext } from '../agent.tool'

describe('RecallRelationsTool path rendering', () => {
  it('renders shortest paths with excerpts in network mode', async () => {
    const tool = new RecallRelationsTool()
    const recallRelations = vi.fn().mockResolvedValue({
      anchors: [{ id: 'a', name: '小明', nodeType: 'person', summary: '' }],
      subgraph: [],
      nodes: [
        { id: 'a', name: '小明', nodeType: 'person' },
        { id: 'b', name: '毕业旅行', nodeType: 'event' },
        { id: 'c', name: '杭州', nodeType: 'place' }
      ],
      paths: [
        {
          nodeIds: ['a', 'b', 'c'],
          nodeNames: ['小明', '毕业旅行', '杭州'],
          edges: [
            {
              id: 'e1',
              fromId: 'a',
              toId: 'b',
              edgeType: 'participates_in',
              sourceExcerpt: '和小明一起去毕业旅行'
            },
            {
              id: 'e2',
              fromId: 'b',
              toId: 'c',
              edgeType: 'located_at',
              sourceExcerpt: '毕业旅行在杭州'
            }
          ]
        }
      ]
    })
    const context = { graphReader: { recallRelations } } as unknown as ToolContext
    const text = await tool.execute({ entity: '小明和杭州', mode: 'network' }, context)
    expect(text).toContain('关系路径')
    expect(text).toContain('小明 → 毕业旅行 → 杭州')
    expect(text).toContain('和小明一起去毕业旅行')
    expect(text).toContain('小明 —participates_in→ 毕业旅行')
    expect(recallRelations).toHaveBeenCalledWith({
      entity: '小明和杭州',
      mode: 'network',
      depth: undefined,
      nodeType: undefined,
      limit: undefined
    })
  })

  it('annotates reverse hop direction when edgeDirections say reverse', async () => {
    const tool = new RecallRelationsTool()
    const recallRelations = vi.fn().mockResolvedValue({
      anchors: [{ id: 'a', name: '杭州', nodeType: 'place', summary: '' }],
      subgraph: [],
      nodes: [
        { id: 'a', name: '杭州', nodeType: 'place' },
        { id: 'b', name: '毕业旅行', nodeType: 'event' }
      ],
      paths: [
        {
          nodeIds: ['a', 'b'],
          nodeNames: ['杭州', '毕业旅行'],
          edgeDirections: ['reverse'],
          edges: [
            {
              id: 'e1',
              fromId: 'b',
              toId: 'a',
              edgeType: 'located_at',
              sourceExcerpt: '毕业旅行在杭州'
            }
          ]
        }
      ]
    })
    const context = { graphReader: { recallRelations } } as unknown as ToolContext
    const text = await tool.execute({ entity: '杭州', mode: 'network' }, context)
    expect(text).toContain('杭州 ←located_at— 毕业旅行')
  })

  it('lists matching entities in search mode', async () => {
    const tool = new RecallRelationsTool()
    const recallRelations = vi.fn().mockResolvedValue({
      anchors: [{ id: 'a', name: '小明', nodeType: 'person', summary: '同学' }],
      subgraph: [],
      nodes: [{ id: 'a', name: '小明', nodeType: 'person', summary: '同学' }]
    })
    const context = { graphReader: { recallRelations } } as unknown as ToolContext
    const text = await tool.execute({ entity: '小明', mode: 'search' }, context)
    expect(text).toContain('匹配实体')
    expect(text).toContain('小明 (person)')
    expect(recallRelations).toHaveBeenCalledWith({
      entity: '小明',
      mode: 'search',
      depth: undefined,
      nodeType: undefined,
      limit: undefined
    })
  })

  it('renders neighbor edges', async () => {
    const tool = new RecallRelationsTool()
    const recallRelations = vi.fn().mockResolvedValue({
      anchors: [{ id: 'a', name: '小明', nodeType: 'person' }],
      subgraph: [
        {
          id: 'e1',
          fromId: 'a',
          toId: 'b',
          edgeType: 'located_at',
          sourceExcerpt: '去了杭州'
        }
      ],
      nodes: [
        { id: 'a', name: '小明', nodeType: 'person' },
        { id: 'b', name: '杭州', nodeType: 'place' }
      ]
    })
    const context = { graphReader: { recallRelations } } as unknown as ToolContext
    const text = await tool.execute({ entity: '小明', mode: 'neighbors' }, context)
    expect(text).toContain('邻居关系')
    expect(text).toContain('小明 —located_at→ 杭州')
    expect(text).toContain('去了杭州')
  })
})
