import { describe, expect, it, vi } from 'vitest'
import { notifyGraphDataChanged, subscribeGraphDataChanged } from '../mobile-graph-data-changed'

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
})
