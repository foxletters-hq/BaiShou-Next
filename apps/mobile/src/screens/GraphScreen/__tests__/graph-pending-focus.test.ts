import { describe, expect, it } from 'vitest'
import {
  consumeGraphPendingFocus,
  requestGraphPendingFocus,
  subscribeGraphPendingFocus
} from '../graph-pending-focus'

describe('mobile graph pending focus', () => {
  it('should notify subscribers and consume the request once', () => {
    consumeGraphPendingFocus()
    let notified = 0
    const stop = subscribeGraphPendingFocus(() => {
      notified += 1
    })
    requestGraphPendingFocus()
    expect(notified).toBe(1)
    expect(consumeGraphPendingFocus()).toBe(true)
    expect(consumeGraphPendingFocus()).toBe(false)
    stop()
  })
})
