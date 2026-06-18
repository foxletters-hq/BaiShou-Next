import { describe, expect, it } from 'vitest'
import {
  shouldPersistNavigationImmediately,
  shouldSkipSessionRestoreForAssistantMismatch,
  shouldThrottleNavigationReconcile
} from '../agent-navigation-restore.util'

describe('shouldSkipSessionRestoreForAssistantMismatch', () => {
  it('returns true when user switched to a different assistant', () => {
    expect(
      shouldSkipSessionRestoreForAssistantMismatch({
        currentAssistantId: 'b',
        savedAssistantId: 'a'
      })
    ).toBe(true)
  })

  it('returns false when assistant matches saved snapshot', () => {
    expect(
      shouldSkipSessionRestoreForAssistantMismatch({
        currentAssistantId: 'a',
        savedAssistantId: 'a'
      })
    ).toBe(false)
  })

  it('returns false when current assistant is not set yet', () => {
    expect(
      shouldSkipSessionRestoreForAssistantMismatch({
        currentAssistantId: null,
        savedAssistantId: 'a'
      })
    ).toBe(false)
  })
})

describe('shouldThrottleNavigationReconcile', () => {
  it('throttles repeated reconcile with the same key inside the window', () => {
    expect(
      shouldThrottleNavigationReconcile({
        reconcileKey: 'vault:a:session-1',
        lastReconcileKey: 'vault:a:session-1',
        lastReconcileAtMs: 1000,
        nowMs: 2500,
        throttleMs: 2000
      })
    ).toBe(true)
  })

  it('allows reconcile after the throttle window', () => {
    expect(
      shouldThrottleNavigationReconcile({
        reconcileKey: 'vault:a:session-1',
        lastReconcileKey: 'vault:a:session-1',
        lastReconcileAtMs: 1000,
        nowMs: 3200,
        throttleMs: 2000
      })
    ).toBe(false)
  })
})

describe('shouldPersistNavigationImmediately', () => {
  it('persists immediately on assistant change', () => {
    expect(
      shouldPersistNavigationImmediately({
        assistantChanged: true,
        sessionCleared: false
      })
    ).toBe(true)
  })

  it('persists immediately when session is cleared', () => {
    expect(
      shouldPersistNavigationImmediately({
        assistantChanged: false,
        sessionCleared: true
      })
    ).toBe(true)
  })
})
