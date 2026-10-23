import { describe, expect, it } from 'vitest'
import {
  resolveMomentumScrollBegin,
  shouldShowScrollToBottomButton,
  shouldTreatScrollAsUserLeave
} from '../agent-chat-scroll.decisions'

describe('resolveMomentumScrollBegin', () => {
  it('should ignore momentum begin when programmatic smooth scroll is in progress', () => {
    expect(
      resolveMomentumScrollBegin({
        isSmoothScrolling: true,
        hasMetrics: true,
        nearContentBottom: false
      })
    ).toBe('ignore')
  })

  it('should exit following when user momentum starts away from the bottom', () => {
    expect(
      resolveMomentumScrollBegin({
        isSmoothScrolling: false,
        hasMetrics: true,
        nearContentBottom: false
      })
    ).toBe('exit_following')
  })

  it('should only track momentum when the user is already near the bottom', () => {
    expect(
      resolveMomentumScrollBegin({
        isSmoothScrolling: false,
        hasMetrics: true,
        nearContentBottom: true
      })
    ).toBe('track')
  })
})

describe('shouldTreatScrollAsUserLeave', () => {
  it('should not treat jitter during programmatic smooth scroll as leaving the bottom', () => {
    expect(
      shouldTreatScrollAsUserLeave({
        isSmoothScrolling: true,
        deltaY: -12,
        isUserDragging: false,
        nearBottom: false
      })
    ).toBe(false)
  })

  it('should treat an upward swipe as leaving when not programmatically scrolling', () => {
    expect(
      shouldTreatScrollAsUserLeave({
        isSmoothScrolling: false,
        deltaY: -12,
        isUserDragging: false,
        nearBottom: false
      })
    ).toBe(true)
  })
})

describe('shouldShowScrollToBottomButton', () => {
  it('should hide the button when idle but still near the bottom', () => {
    expect(
      shouldShowScrollToBottomButton({
        followMode: 'idle',
        nearBottom: true
      })
    ).toBe(false)
  })

  it('should show the button only after leaving the bottom while idle', () => {
    expect(
      shouldShowScrollToBottomButton({
        followMode: 'idle',
        nearBottom: false
      })
    ).toBe(true)
  })

  it('should hide the button while still following', () => {
    expect(
      shouldShowScrollToBottomButton({
        followMode: 'following',
        nearBottom: false
      })
    ).toBe(false)
  })
})
