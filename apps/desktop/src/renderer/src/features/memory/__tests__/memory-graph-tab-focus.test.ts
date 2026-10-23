import { describe, expect, it } from 'vitest'
import {
  consumeMemoryGraphTab,
  requestMemoryGraphTab,
  subscribeMemoryGraphTab
} from '../memory-graph-tab-focus'

describe('memory graph tab focus', () => {
  it('should notify subscribers and consume the tab request once', () => {
    consumeMemoryGraphTab()
    let notified = 0
    const stop = subscribeMemoryGraphTab(() => {
      notified += 1
    })
    requestMemoryGraphTab()
    expect(notified).toBe(1)
    expect(consumeMemoryGraphTab()).toBe(true)
    expect(consumeMemoryGraphTab()).toBe(false)
    stop()
  })
})
