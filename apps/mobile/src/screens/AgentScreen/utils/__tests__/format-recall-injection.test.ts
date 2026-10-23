import { describe, expect, it } from 'vitest'
import { formatRecallInjection } from '../format-recall-injection'

describe('formatRecallInjection', () => {
  it('should return empty text when nothing is selected', () => {
    expect(formatRecallInjection([])).toBe('')
  })

  it('should wrap each memory the same way the desktop composer does', () => {
    expect(
      formatRecallInjection([
        { date: '2026-09-01', title: '雨夜', snippet: '有人敲门' },
        { date: '2026-09-02', title: '清晨', snippet: '雨停了' }
      ])
    ).toBe(
      '<memory date="2026-09-01" source="雨夜">\n有人敲门\n</memory>\n\n<memory date="2026-09-02" source="清晨">\n雨停了\n</memory>'
    )
  })
})
