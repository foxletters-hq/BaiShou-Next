import { describe, expect, it } from 'vitest'
import {
  consumeGraphCanvasLocate,
  consumeGraphOpsNodeFocus,
  requestGraphCanvasLocate,
  requestGraphOpsNodeFocus,
  subscribeGraphCanvasLocate,
  subscribeGraphOpsNodeFocus
} from '../graph-cross-page-focus'

describe('mobile graph cross-page focus', () => {
  it('should notify subscribers and consume a canvas node locate once', () => {
    consumeGraphCanvasLocate()
    let notified = 0
    const stop = subscribeGraphCanvasLocate(() => {
      notified += 1
    })
    requestGraphCanvasLocate({ type: 'node', id: 'n1' })
    expect(notified).toBe(1)
    expect(consumeGraphCanvasLocate()).toEqual({ type: 'node', id: 'n1' })
    expect(consumeGraphCanvasLocate()).toBeNull()
    stop()
  })

  it('should consume an ops node focus once after the canvas asks to open it', () => {
    consumeGraphOpsNodeFocus()
    let notified = 0
    const stop = subscribeGraphOpsNodeFocus(() => {
      notified += 1
    })
    requestGraphOpsNodeFocus('n2')
    expect(notified).toBe(1)
    expect(consumeGraphOpsNodeFocus()).toBe('n2')
    expect(consumeGraphOpsNodeFocus()).toBeNull()
    stop()
  })
})
