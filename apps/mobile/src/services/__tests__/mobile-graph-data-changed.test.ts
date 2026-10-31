import { describe, expect, it, vi } from 'vitest'
import {
  notifyGraphDataChanged,
  notifyGraphOptimisticDelete,
  subscribeGraphDataChanged,
  subscribeGraphOptimisticDelete
} from '../mobile-graph-data-changed'

describe('mobile graph data changed', () => {
  it('should notify subscribers when the life graph is rewritten', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeGraphDataChanged(listener)
    notifyGraphDataChanged()
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    notifyGraphDataChanged()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('should broadcast optimistic node and edge delete phases across graph screens', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeGraphOptimisticDelete(listener)
    notifyGraphOptimisticDelete({
      kind: 'node',
      id: 'node-1',
      deletedEdgeIds: ['edge-1'],
      phase: 'optimistic'
    })
    expect(listener).toHaveBeenCalledWith({
      kind: 'node',
      id: 'node-1',
      deletedEdgeIds: ['edge-1'],
      phase: 'optimistic'
    })
    unsubscribe()
    notifyGraphOptimisticDelete({
      kind: 'node',
      id: 'node-1',
      phase: 'committed'
    })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
