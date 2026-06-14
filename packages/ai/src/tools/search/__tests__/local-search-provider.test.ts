import { describe, expect, it } from 'vitest'
import { WEB_SEARCH_MAX_RESULTS_LIMIT } from '@baishou/shared'
import { LocalBingProvider } from '../local-bing-provider'
import { LocalGoogleProvider } from '../local-google-provider'

describe('local search providers', () => {
  it('builds Bing search URL with count from maxResults', () => {
    const provider = new LocalBingProvider()
    const url = (provider as any).buildSearchUrl('hello world', 8) as string

    expect(url).toContain('q=hello%20world')
    expect(url).toContain('count=8')
  })

  it('builds Google search URL with num from maxResults', () => {
    const provider = new LocalGoogleProvider()
    const url = (provider as any).buildSearchUrl('hello world', 12) as string

    expect(url).toContain('q=hello%20world')
    expect(url).toContain('num=12')
  })

  it(`caps local search URL result count at ${WEB_SEARCH_MAX_RESULTS_LIMIT}`, () => {
    const bing = new LocalBingProvider()
    const google = new LocalGoogleProvider()

    expect((bing as any).buildSearchUrl('q', 99)).toContain(`count=${WEB_SEARCH_MAX_RESULTS_LIMIT}`)
    expect((google as any).buildSearchUrl('q', 99)).toContain(`num=${WEB_SEARCH_MAX_RESULTS_LIMIT}`)
  })
})
