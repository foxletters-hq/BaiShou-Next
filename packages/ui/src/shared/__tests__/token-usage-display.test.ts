import { describe, expect, it } from 'vitest'
import { formatLocaleTokenCount } from '../token-usage-display'

describe('formatLocaleTokenCount', () => {
  it('should add grouping separators for long token counts', () => {
    const formatted = formatLocaleTokenCount(1234567)
    expect(formatted.length).toBeGreaterThan(String(1234567).length)
    expect(formatted.replace(/\D/g, '')).toBe('1234567')
  })
})
