import { describe, expect, it } from 'vitest'
import { setToArray, topologyFingerprint } from '../graph-force-webview.util'

describe('topologyFingerprint', () => {
  it('should stay stable when node and edge order changes', () => {
    const a = topologyFingerprint(
      [
        { id: 'b', name: 'B', nodeType: 'person' },
        { id: 'a', name: 'A', nodeType: 'person' }
      ],
      [
        { id: 'e2', fromId: 'a', toId: 'b', edgeType: 'relates_to' },
        { id: 'e1', fromId: 'b', toId: 'a', edgeType: 'relates_to' }
      ]
    )
    const b = topologyFingerprint(
      [
        { id: 'a', name: 'A', nodeType: 'person' },
        { id: 'b', name: 'B', nodeType: 'person' }
      ],
      [
        { id: 'e1', fromId: 'b', toId: 'a', edgeType: 'relates_to' },
        { id: 'e2', fromId: 'a', toId: 'b', edgeType: 'relates_to' }
      ]
    )
    expect(a).toBe(b)
  })
})

describe('setToArray', () => {
  it('should return an empty list when the set is missing or empty', () => {
    expect(setToArray(null)).toEqual([])
    expect(setToArray(new Set())).toEqual([])
  })

  it('should copy the ids when the set has values', () => {
    expect(setToArray(new Set(['a', 'b']))).toEqual(['a', 'b'])
  })
})
