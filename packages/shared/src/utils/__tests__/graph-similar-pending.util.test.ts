import { describe, expect, it } from 'vitest'
import {
  GRAPH_ALIGN_MIN_SIMILARITY_PERCENT,
  applyAlignedSimilarPendingToProps,
  applySimilarPendingToProps,
  collectSimilarPendingPairs,
  listGraphSimilarPending,
  meetsGraphSimilarPendingThreshold,
  nodePropsHaveSimilarPending,
  parseGraphSimilarPending,
  removeSimilarPendingPeerFromProps
} from '../graph-similar-pending.util'

const PENDING = {
  peerId: 'n-old',
  similarity: 0.72,
  reason: '吃不准',
  sourceExcerpt: '今天见到小张',
  createdAt: '2026-09-19T00:00:00.000Z'
}

describe('parseGraphSimilarPending', () => {
  it('should return null when peerId is missing', () => {
    expect(parseGraphSimilarPending({ similarity: 0.7, reason: 'x' })).toBeNull()
    expect(parseGraphSimilarPending(null)).toBeNull()
  })

  it('should keep excerpt only when it is a non-empty string', () => {
    expect(
      parseGraphSimilarPending({
        ...PENDING,
        sourceExcerpt: '   '
      })
    ).toEqual({
      peerId: 'n-old',
      similarity: 0.72,
      reason: '吃不准',
      createdAt: '2026-09-19T00:00:00.000Z'
    })
  })
})

describe('meetsGraphSimilarPendingThreshold', () => {
  it('should enter similar-pending only when similarity is greater than 70%', () => {
    expect(GRAPH_ALIGN_MIN_SIMILARITY_PERCENT).toBe(70)
    expect(meetsGraphSimilarPendingThreshold(0.7)).toBe(false)
    expect(meetsGraphSimilarPendingThreshold(0.71)).toBe(true)
  })

  it('should treat 0–100 scores as percent so 45% stays below the bar', () => {
    expect(meetsGraphSimilarPendingThreshold(45)).toBe(false)
    expect(meetsGraphSimilarPendingThreshold(72)).toBe(true)
  })
})

describe('applySimilarPendingToProps / removeSimilarPendingPeerFromProps', () => {
  it('should skip writing when similarity is 70% or lower', () => {
    expect(
      applySimilarPendingToProps({}, { ...PENDING, similarity: 0.7 })
    ).toEqual({})
  })

  it('should write a single pair as similarPending', () => {
    const props = applySimilarPendingToProps({ keep: true }, PENDING)
    expect(props.similarPending).toEqual(PENDING)
    expect(props.similarPendingList).toBeUndefined()
    expect(props.keep).toBe(true)
  })

  it('should keep the later batch when the same peer is written twice', () => {
    const first = applySimilarPendingToProps({}, PENDING)
    const later = applySimilarPendingToProps(first, {
      ...PENDING,
      similarity: 0.91,
      reason: '后一批更清楚',
      createdAt: '2026-09-19T01:00:00.000Z'
    })
    expect(listGraphSimilarPending(later)).toEqual([
      {
        peerId: 'n-old',
        similarity: 0.91,
        reason: '后一批更清楚',
        sourceExcerpt: '今天见到小张',
        createdAt: '2026-09-19T01:00:00.000Z'
      }
    ])
  })

  it('should upgrade to similarPendingList when a second peer is added', () => {
    const once = applySimilarPendingToProps({}, PENDING)
    const twice = applySimilarPendingToProps(once, {
      ...PENDING,
      peerId: 'n-other',
      reason: '另一个'
    })
    expect(twice.similarPending).toBeUndefined()
    expect(listGraphSimilarPending(twice).map((item) => item.peerId)).toEqual(['n-old', 'n-other'])
  })

  it('should remove one peer and collapse back to a single field', () => {
    const two = applySimilarPendingToProps(applySimilarPendingToProps({}, PENDING), {
      ...PENDING,
      peerId: 'n-other'
    })
    const one = removeSimilarPendingPeerFromProps(two, 'n-other')
    expect(one.similarPending).toEqual(expect.objectContaining({ peerId: 'n-old' }))
    expect(one.similarPendingList).toBeUndefined()
  })

  it('should clear both keys when the last peer is removed', () => {
    const cleared = removeSimilarPendingPeerFromProps(
      applySimilarPendingToProps({}, PENDING),
      'n-old'
    )
    expect(listGraphSimilarPending(cleared)).toEqual([])
    expect(cleared.similarPending).toBeUndefined()
    expect(cleared.similarPendingList).toBeUndefined()
  })
})

describe('applyAlignedSimilarPendingToProps', () => {
  it('should skip reused alignment so existing nodes do not get the pending mark', () => {
    expect(
      applyAlignedSimilarPendingToProps({}, { reused: true, similarPending: PENDING })
    ).toEqual({})
  })

  it('should write similarPending when alignment created a new node', () => {
    expect(
      applyAlignedSimilarPendingToProps({}, { reused: false, similarPending: PENDING })
    ).toEqual({ similarPending: PENDING })
  })
})

describe('collectSimilarPendingPairs', () => {
  it('should emit a pair when the peer is still live', () => {
    const pairs = collectSimilarPendingPairs(
      [
        {
          id: 'n-new',
          name: '小张',
          props: { similarPending: PENDING }
        }
      ],
      new Map([['n-old', '张三']])
    )
    expect(pairs).toEqual([
      {
        nodeId: 'n-new',
        nodeName: '小张',
        peerId: 'n-old',
        peerName: '张三',
        similarity: 0.72,
        reason: '吃不准',
        sourceExcerpt: '今天见到小张',
        createdAt: '2026-09-19T00:00:00.000Z'
      }
    ])
  })

  it('should skip a pair when the peer is missing after merge or delete', () => {
    expect(
      collectSimilarPendingPairs(
        [{ id: 'n-new', name: '小张', props: { similarPending: PENDING } }],
        new Map()
      )
    ).toEqual([])
  })

  it('should hide a stored pair when similarity is 70% or lower', () => {
    expect(
      collectSimilarPendingPairs(
        [
          {
            id: 'n-new',
            name: '小张',
            props: { similarPending: { ...PENDING, similarity: 0.7 } }
          }
        ],
        new Map([['n-old', '张三']])
      )
    ).toEqual([])
    expect(
      nodePropsHaveSimilarPending(JSON.stringify({ similarPending: { ...PENDING, similarity: 0.7 } }))
    ).toBe(false)
  })

  it('should hide a stored pair written as 45 percent instead of 0.45', () => {
    expect(
      collectSimilarPendingPairs(
        [
          {
            id: 'n-new',
            name: '小张',
            props: { similarPending: { ...PENDING, similarity: 45 } }
          }
        ],
        new Map([['n-old', '张三']])
      )
    ).toEqual([])
  })

  it('should list a stored pair written as 72 percent as 72%', () => {
    const pairs = collectSimilarPendingPairs(
      [
        {
          id: 'n-new',
          name: '小张',
          props: { similarPending: { ...PENDING, similarity: 72 } }
        }
      ],
      new Map([['n-old', '张三']])
    )
    expect(pairs).toEqual([
      expect.objectContaining({
        nodeId: 'n-new',
        peerId: 'n-old',
        similarity: 0.72
      })
    ])
  })

  it('should ignore suspectReason-only props', () => {
    expect(nodePropsHaveSimilarPending(JSON.stringify({ suspectReason: '同人异职' }))).toBe(false)
    expect(
      collectSimilarPendingPairs(
        [{ id: 'n-s', name: '可疑', propsJson: JSON.stringify({ suspectReason: '同人异职' }) }],
        new Map([['n-s', '可疑']])
      )
    ).toEqual([])
  })
})
