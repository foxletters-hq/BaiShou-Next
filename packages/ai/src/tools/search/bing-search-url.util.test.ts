import { describe, it, expect } from 'vitest'
import { resolveBingClickThroughUrl } from './bing-search-url.util'

describe('resolveBingClickThroughUrl', () => {
  it('decodes Bing ck/a redirect URL', () => {
    const bingUrl = 'https://www.bing.com/ck/a?u=a1aHR0cHM6Ly9leGFtcGxlLmNvbQ=='
    expect(resolveBingClickThroughUrl(bingUrl)).toBe('https://example.com')
  })

  it('returns original URL when u parameter is missing', () => {
    const url = 'https://example.com'
    expect(resolveBingClickThroughUrl(url)).toBe(url)
  })

  it('returns original URL when decoding fails', () => {
    const url = 'https://www.bing.com/ck/a?u=invalid'
    expect(resolveBingClickThroughUrl(url)).toBe(url)
  })
})
