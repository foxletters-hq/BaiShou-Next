import { describe, expect, it } from 'vitest'
import {
  expandApprovedGraphReviewEdgeIds,
  graphPendingItemKey,
  isGraphReviewStatus,
  parseGraphPendingItemKey,
  splitGraphReviewSelection,
  uniqueNonEmptyIds
} from '../graph-review-batch.util'

describe('graph pending selection keys', () => {
  it('round-trips node and edge keys', () => {
    expect(parseGraphPendingItemKey(graphPendingItemKey('node', 'n1'))).toEqual({
      kind: 'node',
      id: 'n1'
    })
    expect(parseGraphPendingItemKey(graphPendingItemKey('edge', 'e1'))).toEqual({
      kind: 'edge',
      id: 'e1'
    })
    expect(parseGraphPendingItemKey('nope')).toBeNull()
    expect(parseGraphPendingItemKey('node:')).toBeNull()
  })

  it('splits selected keys and drops duplicates', () => {
    expect(
      splitGraphReviewSelection([
        'node:a',
        'edge:e1',
        'node:a',
        'edge:e1',
        'bad',
        'node:b'
      ])
    ).toEqual({ nodeIds: ['a', 'b'], edgeIds: ['e1'] })
  })
})

describe('expandApprovedGraphReviewEdgeIds', () => {
  it('adds pending incident edges when approving nodes', () => {
    expect(
      expandApprovedGraphReviewEdgeIds({
        nodeIds: ['n1', ''],
        edgeIds: ['e-keep', 'e-keep'],
        pendingEdges: [
          { id: 'e-keep', fromId: 'x', toId: 'y' },
          { id: 'e-incident', fromId: 'n1', toId: 'n9' },
          { id: 'e-other', fromId: 'a', toId: 'b' }
        ]
      })
    ).toEqual(['e-keep', 'e-incident'])
  })
})

describe('uniqueNonEmptyIds / isGraphReviewStatus', () => {
  it('normalizes ids and review status', () => {
    expect(uniqueNonEmptyIds([' a ', '', 'a', 'b'])).toEqual(['a', 'b'])
    expect(isGraphReviewStatus('approved')).toBe(true)
    expect(isGraphReviewStatus('pending')).toBe(false)
  })
})
