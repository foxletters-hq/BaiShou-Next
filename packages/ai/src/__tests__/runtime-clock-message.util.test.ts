import { describe, it, expect, vi } from 'vitest'
import {
  RUNTIME_CLOCK_PREFIX,
  formatRuntimeClockContent,
  insertRuntimeClockIfEnabled,
  insertRuntimeClockSystemMessage,
  isRuntimeClockMessage
} from '../agent/runtime-clock-message.util'

describe('runtime-clock-message.util', () => {
  it('formats date and clock time with timezone', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 31, 4, 48, 7))
    const content = formatRuntimeClockContent()
    vi.useRealTimers()

    expect(content).toContain(RUNTIME_CLOCK_PREFIX)
    expect(content).toMatch(/2026-08-31 04:48:07/)
    expect(content).toMatch(/\(UTC[+-]\d+(?:\.\d+)?\)/)
    expect(content).toContain('Use it for "now"')
  })

  it('inserts the clock system message immediately before the last user message', () => {
    const next = insertRuntimeClockSystemMessage(
      [
        { role: 'user', content: '昨天的事' },
        { role: 'assistant', content: '好的' },
        { role: 'user', content: '现在几点' }
      ],
      new Date(2026, 7, 31, 4, 48, 0)
    )

    expect(next).toHaveLength(4)
    expect(next[0]).toEqual({ role: 'user', content: '昨天的事' })
    expect(next[1]).toEqual({ role: 'assistant', content: '好的' })
    expect(isRuntimeClockMessage(next[2]!)).toBe(true)
    expect(next[3]).toEqual({ role: 'user', content: '现在几点' })
  })

  it('replaces an existing clock message instead of stacking another', () => {
    const first = insertRuntimeClockSystemMessage(
      [{ role: 'user', content: 'hi' }],
      new Date(2026, 7, 31, 4, 0, 0)
    )
    const second = insertRuntimeClockSystemMessage(first, new Date(2026, 7, 31, 4, 1, 0))

    expect(second.filter((message) => isRuntimeClockMessage(message))).toHaveLength(1)
    expect(second[0]?.content).toContain('04:01:00')
    expect(second[1]).toEqual({ role: 'user', content: 'hi' })
  })

  it('does not insert when the auto-inject switch is off', () => {
    const messages = [{ role: 'user' as const, content: 'hi' }]
    expect(insertRuntimeClockIfEnabled(messages, false)).toBe(messages)
  })
})
