import { describe, expect, it, vi } from 'vitest'
import {
  applySuspectReasonToProps,
  buildSuspectReasonPrompt,
  collectSuspectPromptFacts,
  collectSuspectSignals,
  GRAPH_SUSPECT_ESTABLISHED_EDGE_MIN,
  GRAPH_SUSPECT_SIGNALS,
  parseSourceRefYearMonth,
  parseSuspectReasonDecision,
  removeSuspectReasonFromProps,
  runGraphSuspectScan,
  sourceRefSpanMonths
} from '../graph-suspect-scan'

function person(
  id: string,
  extras?: {
    discriminator?: string
    props?: Record<string, unknown>
    origin?: string
    reviewStatus?: string
  }
) {
  return {
    id,
    name: '张三',
    nodeType: 'person',
    discriminator: extras?.discriminator,
    props: extras?.props ?? {},
    origin: extras?.origin,
    reviewStatus: extras?.reviewStatus
  }
}

function mention(fromId: string, toId: string, sourceRef: string) {
  return { fromId, toId, edgeType: 'mentions', isCurrent: true, sourceRef }
}

describe('collectSuspectSignals', () => {
  it('should hit when a person has two current role_of edges to different orgs', () => {
    const hits = collectSuspectSignals(
      [
        person('p1'),
        { id: 'o1', name: '甲公司', nodeType: 'organization', props: {} },
        { id: 'o2', name: '乙公司', nodeType: 'organization', props: {} }
      ],
      [
        {
          fromId: 'p1',
          toId: 'o1',
          edgeType: 'role_of',
          isCurrent: true,
          sourceRef: '2024-01-01'
        },
        {
          fromId: 'p1',
          toId: 'o2',
          edgeType: 'role_of',
          isCurrent: true,
          sourceRef: '2024-02-01'
        }
      ]
    )
    expect(hits).toEqual([{ nodeId: 'p1', signals: ['multiple_role_of'] }])
  })

  it('should not hit when two current role_of edges point to the same org', () => {
    const hits = collectSuspectSignals(
      [person('p1'), { id: 'o1', name: '甲公司', nodeType: 'organization', props: {} }],
      [
        {
          fromId: 'p1',
          toId: 'o1',
          edgeType: 'role_of',
          isCurrent: true,
          sourceRef: '2024-01-01'
        },
        {
          fromId: 'p1',
          toId: 'o1',
          edgeType: 'role_of',
          isCurrent: true,
          sourceRef: '2024-06-01'
        }
      ]
    )
    expect(hits).toEqual([])
  })

  it('should hit when a person has two current located_at edges to different places', () => {
    const hits = collectSuspectSignals(
      [
        person('p1'),
        { id: 'pl1', name: '北京', nodeType: 'place', props: {} },
        { id: 'pl2', name: '上海', nodeType: 'place', props: {} }
      ],
      [
        {
          fromId: 'p1',
          toId: 'pl1',
          edgeType: 'located_at',
          isCurrent: true,
          sourceRef: '2024-01'
        },
        {
          fromId: 'p1',
          toId: 'pl2',
          edgeType: 'located_at',
          isCurrent: true,
          sourceRef: '2024-02'
        }
      ]
    )
    expect(hits).toEqual([{ nodeId: 'p1', signals: ['multiple_located_at'] }])
  })

  it('should ignore historical located_at edges when collecting place conflicts', () => {
    const hits = collectSuspectSignals(
      [
        person('p1'),
        { id: 'pl1', name: '北京', nodeType: 'place', props: {} },
        { id: 'pl2', name: '上海', nodeType: 'place', props: {} }
      ],
      [
        {
          fromId: 'p1',
          toId: 'pl1',
          edgeType: 'located_at',
          isCurrent: true,
          sourceRef: '2024-01'
        },
        {
          fromId: 'p1',
          toId: 'pl2',
          edgeType: 'located_at',
          isCurrent: false,
          sourceRef: '2022-01'
        }
      ]
    )
    expect(hits).toEqual([])
  })

  it('should hit when source refs span at least 18 months and there are three sources', () => {
    const hits = collectSuspectSignals(
      [person('p1')],
      [
        {
          fromId: 'p1',
          toId: 'e1',
          edgeType: 'mentions',
          isCurrent: true,
          sourceRef: '2023-01-02'
        },
        {
          fromId: 'p1',
          toId: 'e2',
          edgeType: 'mentions',
          isCurrent: true,
          sourceRef: '2023-06-02'
        },
        {
          fromId: 'p1',
          toId: 'e3',
          edgeType: 'mentions',
          isCurrent: true,
          sourceRef: '2024-07-02'
        }
      ]
    )
    expect(hits).toEqual([{ nodeId: 'p1', signals: ['source_span'] }])
  })

  it('should not hit when three sources span only 17 months', () => {
    const hits = collectSuspectSignals(
      [person('p1')],
      [
        {
          fromId: 'p1',
          toId: 'e1',
          edgeType: 'mentions',
          isCurrent: true,
          sourceRef: '2023-01-01'
        },
        {
          fromId: 'p1',
          toId: 'e2',
          edgeType: 'mentions',
          isCurrent: true,
          sourceRef: '2023-06-01'
        },
        {
          fromId: 'p1',
          toId: 'e3',
          edgeType: 'mentions',
          isCurrent: true,
          sourceRef: '2024-06-01'
        }
      ]
    )
    expect(hits).toEqual([])
  })

  it('should hit a bare-name node that already has ambiguousSourceRefs', () => {
    const hits = collectSuspectSignals(
      [person('p1', { props: { ambiguousSourceRefs: ['2024-01-01'] } })],
      []
    )
    expect(hits).toEqual([{ nodeId: 'p1', signals: ['ambiguous'] }])
  })

  it('should not treat a split node with ambiguousSourceRefs as the bare-name signal', () => {
    const hits = collectSuspectSignals(
      [
        person('p1', {
          discriminator: '同事',
          props: { ambiguousSourceRefs: ['2024-01-01'] }
        })
      ],
      []
    )
    expect(hits).toEqual([])
  })
})

describe('sourceRef date helpers', () => {
  it('should parse YYYY-MM and YYYY-MM-DD from a sourceRef', () => {
    expect(parseSourceRefYearMonth('2024-03-15')).toEqual({ year: 2024, month: 3 })
    expect(parseSourceRefYearMonth('Journal/2024-03.md')).toEqual({ year: 2024, month: 3 })
    expect(parseSourceRefYearMonth('src1#0')).toBeNull()
  })

  it('should measure the month span between source refs', () => {
    expect(sourceRefSpanMonths(['2023-01-01', '2024-07-01'])).toBe(18)
    expect(sourceRefSpanMonths(['2023-01-01', '2024-06-01'])).toBe(17)
  })
})

describe('removeSuspectReasonFromProps', () => {
  it('should drop suspectReason when the user reviews the node', () => {
    const marked = applySuspectReasonToProps(
      { aliases: ['阿三'] },
      '同时挂了两家公司',
      ['multiple_located_at']
    )
    expect(removeSuspectReasonFromProps(marked)).toEqual({
      aliases: ['阿三'],
      suspectClearedSignals: ['multiple_located_at']
    })
  })

  it('should remember all known signals when a legacy node had no suspectSignals', () => {
    expect(removeSuspectReasonFromProps({ aliases: ['阿三'], suspectReason: '旧理由' })).toEqual({
      aliases: ['阿三'],
      suspectClearedSignals: [...GRAPH_SUSPECT_SIGNALS]
    })
    expect(removeSuspectReasonFromProps({ aliases: ['阿三'] })).toEqual({ aliases: ['阿三'] })
  })
})

describe('parseSuspectReasonDecision', () => {
  it('should read the reason when the model marks the node as suspect', () => {
    expect(parseSuspectReasonDecision('{"suspect":true,"reason":"同时挂了两家公司"}')).toBe(
      '同时挂了两家公司'
    )
  })

  it('should return null when the model says it is not suspect', () => {
    expect(parseSuspectReasonDecision('{"suspect":false}')).toBeNull()
    expect(parseSuspectReasonDecision('{"suspect":true,"reason":""}')).toBeNull()
  })
})

describe('runGraphSuspectScan', () => {
  it('should persist only when the model gives a suspicion reason', async () => {
    const persist = vi.fn()
    const result = await runGraphSuspectScan({
      nodes: [person('p1', { props: { ambiguousSourceRefs: ['a'] } })],
      edges: [],
      llm: async () => JSON.stringify({ suspect: true, reason: '裸名出处冲突' }),
      persist
    })
    expect(result).toEqual({ collected: 1, persisted: 1 })
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), '裸名出处冲突', [
      'ambiguous'
    ])
  })

  it('should not persist when the model says not-suspect or throws', async () => {
    const persist = vi.fn()
    const skipped = await runGraphSuspectScan({
      nodes: [person('p1', { props: { ambiguousSourceRefs: ['a'] } })],
      edges: [],
      llm: async () => JSON.stringify({ suspect: false }),
      persist
    })
    expect(skipped.persisted).toBe(0)
    const thrown = await runGraphSuspectScan({
      nodes: [person('p1', { props: { ambiguousSourceRefs: ['a'] } })],
      edges: [],
      llm: async () => {
        throw new Error('down')
      },
      persist
    })
    expect(thrown.persisted).toBe(0)
    expect(persist).not.toHaveBeenCalled()
  })

  it('should skip already-reasoned nodes when counting the LLM cap', async () => {
    const llm = vi.fn(async () => JSON.stringify({ suspect: false }))
    await runGraphSuspectScan({
      nodes: [
        person('p-old', { props: { ambiguousSourceRefs: ['a'], suspectReason: '已有理由' } }),
        person('p-new', { props: { ambiguousSourceRefs: ['b'] } })
      ],
      edges: [],
      llm,
      persist: async () => undefined
    })
    expect(llm).toHaveBeenCalledTimes(1)
  })

  it('should cap LLM calls at 40 signal nodes', async () => {
    const llm = vi.fn(async () => JSON.stringify({ suspect: false }))
    const nodes = Array.from({ length: 41 }, (_, i) =>
      person(`p${i}`, { props: { ambiguousSourceRefs: ['a'] } })
    )
    await runGraphSuspectScan({
      nodes,
      edges: [],
      llm,
      persist: async () => undefined
    })
    expect(llm).toHaveBeenCalledTimes(40)
  })

  it('should skip a node whose current signals were already cleared', async () => {
    const persist = vi.fn()
    const llm = vi.fn(async () => JSON.stringify({ suspect: true, reason: '不该再写' }))
    const result = await runGraphSuspectScan({
      nodes: [
        person('p1', {
          props: {
            ambiguousSourceRefs: ['a'],
            suspectClearedSignals: ['ambiguous']
          }
        })
      ],
      edges: [],
      llm,
      persist
    })
    expect(result).toEqual({ collected: 1, persisted: 0 })
    expect(llm).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
  })

  it('should persist again when a new signal appears beyond the cleared set', async () => {
    const persist = vi.fn()
    const result = await runGraphSuspectScan({
      nodes: [
        person('p1', {
          props: {
            ambiguousSourceRefs: ['a'],
            suspectClearedSignals: ['ambiguous']
          }
        }),
        { id: 'pl1', name: '北京', nodeType: 'place', props: {} },
        { id: 'pl2', name: '上海', nodeType: 'place', props: {} }
      ],
      edges: [
        {
          fromId: 'p1',
          toId: 'pl1',
          edgeType: 'located_at',
          isCurrent: true,
          sourceRef: '2024-01'
        },
        {
          fromId: 'p1',
          toId: 'pl2',
          edgeType: 'located_at',
          isCurrent: true,
          sourceRef: '2024-02'
        }
      ],
      llm: async () => JSON.stringify({ suspect: true, reason: '同时挂着北京和上海' }),
      persist
    })
    expect(result.persisted).toBe(1)
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      '同时挂着北京和上海',
      ['multiple_located_at', 'ambiguous']
    )
  })

  it('should skip a user-edited node even when it is still pending', async () => {
    const persist = vi.fn()
    const llm = vi.fn(async () => JSON.stringify({ suspect: true, reason: '不该再写' }))
    const result = await runGraphSuspectScan({
      nodes: [
        person('p1', {
          origin: 'user',
          reviewStatus: 'pending',
          props: { ambiguousSourceRefs: ['a'] }
        })
      ],
      edges: [],
      llm,
      persist
    })
    expect(result).toEqual({ collected: 1, persisted: 0 })
    expect(llm).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
  })

  it('should skip an approved node that already has many live edges', async () => {
    const persist = vi.fn()
    const llm = vi.fn(async () => JSON.stringify({ suspect: true, reason: '不该再写' }))
    const edges = Array.from({ length: GRAPH_SUSPECT_ESTABLISHED_EDGE_MIN }, (_, i) =>
      mention('p1', `e${i}`, `2024-01-0${(i % 9) + 1}`)
    )
    const result = await runGraphSuspectScan({
      nodes: [
        person('p1', {
          reviewStatus: 'approved',
          props: { ambiguousSourceRefs: ['a'] }
        })
      ],
      edges,
      llm,
      persist
    })
    expect(result.collected).toBe(1)
    expect(result.persisted).toBe(0)
    expect(llm).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
  })
})

describe('buildSuspectReasonPrompt', () => {
  it('should give the model neighbor names and forbid inventing from the display name', () => {
    const nodes = [
      person('p1'),
      { id: 'pl1', name: '北京', nodeType: 'place', props: {} },
      { id: 'pl2', name: '上海', nodeType: 'place', props: {} }
    ]
    const edges = [
      {
        fromId: 'p1',
        toId: 'pl1',
        edgeType: 'located_at',
        isCurrent: true,
        sourceRef: '2024-01'
      },
      {
        fromId: 'p1',
        toId: 'pl2',
        edgeType: 'located_at',
        isCurrent: true,
        sourceRef: '2024-02'
      }
    ]
    const facts = collectSuspectPromptFacts(nodes[0]!, nodes, edges)
    expect(facts.currentPlaces).toEqual(['北京', '上海'])
    const prompt = buildSuspectReasonPrompt({
      node: nodes[0]!,
      signals: ['multiple_located_at'],
      facts
    })
    expect(prompt.system).toContain('禁止根据名字联想')
    expect(prompt.user).toContain('北京')
    expect(prompt.user).toContain('上海')
  })
})
