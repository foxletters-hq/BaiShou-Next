import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'useAgentChatScroll.ts'),
  'utf8'
)

describe('useAgentChatScroll programmatic bottom chrome', () => {
  it('should ignore RN momentum begin during programmatic scroll-to-bottom', () => {
    expect(src).toContain('resolveMomentumScrollBegin')
    expect(src).toContain("if (action === 'ignore') return")
  })

  it('should sync the scroll-to-bottom button from idle and near-bottom, not idle alone', () => {
    expect(src).toContain('shouldShowScrollToBottomButton')
    expect(src).toContain('syncShowScrollButton')
    expect(src).not.toContain("setShowScrollButton(mode === 'idle')")
  })
})

const helperSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-chat-scroll.helpers.ts'),
  'utf8'
)

describe('agent-chat-scroll helper wiring chrome', () => {
  it('should skip leave detection during programmatic smooth scroll', () => {
    expect(helperSrc).toContain('shouldTreatScrollAsUserLeave')
    expect(helperSrc).toContain('isSmoothScrolling: isSmoothScrollingRef.current')
  })
})
