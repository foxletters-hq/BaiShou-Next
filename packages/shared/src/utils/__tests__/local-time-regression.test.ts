import { describe, it, expect } from 'vitest'
import {
  formatLocalDate,
  formatLocalDateFromInstant,
  formatMessageTimestamp,
  formatRecallDiaryDate,
  formatRecallTimestamp
} from '../date.utils'

/**
 * 回归：跨日长会话凌晨消息被 UTC 标为前一天（message_search / 回忆搜索）。
 * 用本地 Date 构造，不依赖运行环境时区即可稳定断言展示值。
 */
describe('local time regression — cross-midnight session', () => {
  const nightmareAt = new Date(2025, 5, 21, 1, 30)

  it('formatRecallTimestamp shows local calendar day and time', () => {
    expect(formatRecallTimestamp(nightmareAt)).toBe('2025-06-21 01:30')
  })

  it('formatMessageTimestamp matches recall/message_search display', () => {
    expect(formatMessageTimestamp(nightmareAt)).toBe(formatRecallTimestamp(nightmareAt))
  })

  it('does not use UTC ISO date when it lags local calendar day', () => {
    const legacyUtcDate = nightmareAt.toISOString().split('T')[0]!
    const displayed = formatRecallTimestamp(nightmareAt)

    expect(displayed.startsWith('2025-06-21')).toBe(true)
    if (legacyUtcDate !== '2025-06-21') {
      expect(displayed).not.toContain(legacyUtcDate)
    }
  })
})

/** 回忆搜索 UI 契约：日记归档日 vs 记忆时刻 */
describe('recall search display contract', () => {
  const diaryCalendarDay = new Date(2025, 5, 21)
  const memoryInstant = new Date(2025, 5, 21, 1, 30)

  it('diary tab uses calendar date only (YYYY-MM-DD)', () => {
    expect(formatRecallDiaryDate(diaryCalendarDay)).toBe('2025-06-21')
    expect(formatRecallDiaryDate('2025-06-21')).toBe('2025-06-21')
    expect(formatRecallDiaryDate(diaryCalendarDay)).not.toMatch(/:\d{2}/)
  })

  it('memory tab uses full local timestamp (YYYY-MM-DD HH:mm)', () => {
    expect(formatRecallTimestamp(memoryInstant)).toBe('2025-06-21 01:30')
    expect(formatRecallTimestamp(memoryInstant)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('diary date ignores time-of-day on same calendar day', () => {
    const morning = new Date(2025, 5, 21, 8, 0)
    const midnight = new Date(2025, 5, 21, 0, 0)
    expect(formatRecallDiaryDate(morning)).toBe(formatRecallDiaryDate(midnight))
  })
})

describe('formatLocalDateFromInstant vs legacy UTC split', () => {
  it('calendar-day extraction stays on local date', () => {
    const instant = new Date(2025, 5, 21, 0, 15)
    expect(formatLocalDateFromInstant(instant)).toBe('2025-06-21')
    expect(formatLocalDate(instant)).toBe('2025-06-21')
  })
})
