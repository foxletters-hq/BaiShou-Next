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

  it('uses the same limit for neighbor edges instead of a hardcoded 24', async () => {
    const tool = new RecallRelationsTool()
    const subgraph = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`,
      fromId: 'a',
      toId: `n${i}`,
      edgeType: 'relates_to',
      sourceExcerpt: `摘录${i}`
    }))
    const nodes = [
      { id: 'a', name: '小明', nodeType: 'person' },
      ...subgraph.map((_, i) => ({ id: `n${i}`, name: `邻${i}`, nodeType: 'person' }))
    ]
    const recallRelations = vi.fn().mockResolvedValue({
      anchors: [{ id: 'a', name: '小明', nodeType: 'person' }],
      subgraph,
      nodes
    })
    const context = { graphReader: { recallRelations } } as unknown as ToolContext
    const text = await tool.execute({ entity: '小明', mode: 'neighbors', limit: 3 }, context)
    expect(text).toContain('邻0')
    expect(text).toContain('邻2')
    expect(text).not.toContain('邻3')
    expect(text).not.toContain('邻7')
  })

  it('includes node and edge ids with source and validFrom', async () => {
    const tool = new RecallRelationsTool()
    const validFrom = new Date(2025, 5, 20).getTime()
    const recallRelations = vi.fn().mockResolvedValue({
      anchors: [{ id: 'lib', name: '图书馆', nodeType: 'place' }],
      subgraph: [
        {
          id: 'e-in',
          fromId: 'atlas',
          toId: 'lib',
          edgeType: 'located_at',
          sourceRef: '2025-06-20',
          sourceExcerpt: '去过图书馆',
          validFrom,
          isCurrent: true
        }
      ],
      nodes: [
        { id: 'lib', name: '图书馆', nodeType: 'place' },
        { id: 'atlas', name: '地图册', nodeType: 'work' }
      ]
    })
    const context = { graphReader: { recallRelations } } as unknown as ToolContext
    const search = await tool.execute({ entity: '图书馆', mode: 'search' }, context)
    expect(search).toContain('id=lib')

    const neighbors = await tool.execute({ entity: '图书馆', mode: 'neighbors' }, context)
    expect(neighbors).toContain('id=e-in')
    expect(neighbors).toContain('[来源:2025-06-20]')
    expect(neighbors).toContain('[validFrom:2025-06-20]')
  })

  it('marks superseded timeline edges as 已失效', async () => {
    const tool = new RecallRelationsTool()
    const recallRelations = vi.fn().mockResolvedValue({
      anchors: [{ id: 'a', name: '测试人物A', nodeType: 'person' }],
      subgraph: [],
      timeline: [
        {
          id: 'e-old',
          fromId: 'a',
          toId: 'b',
          edgeType: '位于',
          isCurrent: false,
          sourceRef: '2025-06-20'
        },
        {
          id: 'e-new',
          fromId: 'a',
          toId: 'b',
          edgeType: '工作于',
          isCurrent: true,
          sourceRef: '2025-06-21'
        }
      ],
      nodes: [
        { id: 'a', name: '测试人物A', nodeType: 'person' },
        { id: 'b', name: '测试地点B', nodeType: 'place' }
      ]
    })
    const context = { graphReader: { recallRelations } } as unknown as ToolContext
    const text = await tool.execute({ entity: '测试人物A', mode: 'timeline' }, context)
    expect(text).toContain('id=e-old')
    expect(text).toContain('（已失效）')
    expect(text).toContain('id=e-new')
  })

  it('explains current-edge disconnect when network finds no path', async () => {
    const tool = new RecallRelationsTool()
    const recallRelations = vi.fn().mockResolvedValue({
      anchors: [
        { id: 'atlas', name: '地图册', nodeType: 'work' },
        { id: 'lib', name: '图书馆', nodeType: 'place' }
      ],
      subgraph: [],
      nodes: [
        { id: 'atlas', name: '地图册', nodeType: 'work' },
        { id: 'lib', name: '图书馆', nodeType: 'place' }
      ],
      paths: []
    })
    const context = { graphReader: { recallRelations } } as unknown as ToolContext
    const text = await tool.execute({ entity: '地图册 图书馆', mode: 'network' }, context)
    expect(text).toContain('未找到连接路径')
    expect(text).toContain('「地图册」')
    expect(text).toContain('「图书馆」')
    expect(text).toContain('当前边未连通')
  })

  it('tells the model it may retry after a later write', async () => {
    const tool = new RecallRelationsTool()
    const recallRelations = vi.fn().mockResolvedValue({
      anchors: [],
      subgraph: [],
      nodes: []
    })
    const context = { graphReader: { recallRelations } } as unknown as ToolContext
    const text = await tool.execute({ entity: '不存在的人', mode: 'search' }, context)
    expect(text).toContain('未找到「不存在的人」')
    expect(text).toContain('本次不要用同一名字空转')
    expect(text).toContain('用户刚写入或再次追问后可以再查')
    expect(text).not.toContain('Do not retry this tool')
  })
})
