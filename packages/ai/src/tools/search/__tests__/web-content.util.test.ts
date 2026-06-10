import { describe, it, expect } from 'vitest'
import { truncateSearchSnippet } from '../web-content.util'

describe('truncateSearchSnippet', () => {
  it('returns text unchanged when within limit', () => {
    expect(truncateSearchSnippet('hello', 10)).toBe('hello')
  })

  it('truncates and appends suffix when over limit', () => {
    const result = truncateSearchSnippet('a'.repeat(100), 50)
    expect(result.startsWith('a'.repeat(50))).toBe(true)
    expect(result).toContain('truncated')
  })
})
