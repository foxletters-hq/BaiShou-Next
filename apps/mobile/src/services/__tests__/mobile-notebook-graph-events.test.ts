import { describe, expect, it, vi } from 'vitest'
import {
  notifyNotebookGraphChanged,
  subscribeNotebookGraphChanged
} from '../mobile-notebook-graph-events'

describe('mobile notebook graph events', () => {
  it('should notify subscribers for the matching notebookId and allow unsubscribe', () => {
    const listenerA = vi.fn()
    const listenerB = vi.fn()
    const unsubA = subscribeNotebookGraphChanged('nb-1', listenerA)
    const unsubB = subscribeNotebookGraphChanged('nb-2', listenerB)

    notifyNotebookGraphChanged('nb-1')
    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).not.toHaveBeenCalled()

    notifyNotebookGraphChanged('nb-2')
    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledTimes(1)

    unsubA()
    notifyNotebookGraphChanged('nb-1')
    expect(listenerA).toHaveBeenCalledTimes(1)

    unsubB()
    notifyNotebookGraphChanged('nb-2')
    expect(listenerB).toHaveBeenCalledTimes(1)
  })
})
