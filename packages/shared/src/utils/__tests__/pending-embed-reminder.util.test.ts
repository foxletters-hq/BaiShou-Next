import { describe, expect, it } from 'vitest'
import {
  isStartupEmbedReminderEnabled,
  resetPendingEmbedReminderForTests,
  shouldShowPendingEmbedReminder
} from '../pending-embed-reminder.util'

describe('shouldShowPendingEmbedReminder', () => {
  it('shows once per launch when total > 0, then stays silent', () => {
    resetPendingEmbedReminderForTests()
    expect(shouldShowPendingEmbedReminder(0)).toBe(false)
    expect(shouldShowPendingEmbedReminder(3)).toBe(true)
    expect(shouldShowPendingEmbedReminder(3)).toBe(false)
  })

  it('does not consume the once-per-launch flag when the user turned the check off', () => {
    resetPendingEmbedReminderForTests()
    expect(shouldShowPendingEmbedReminder(3, { enabled: false })).toBe(false)
    expect(shouldShowPendingEmbedReminder(3, { enabled: true })).toBe(true)
  })
})

describe('isStartupEmbedReminderEnabled', () => {
  it('treats a missing flag as enabled', () => {
    expect(isStartupEmbedReminderEnabled(null)).toBe(true)
    expect(isStartupEmbedReminderEnabled({})).toBe(true)
    expect(isStartupEmbedReminderEnabled({ startupEmbedReminder: false })).toBe(false)
  })
})
