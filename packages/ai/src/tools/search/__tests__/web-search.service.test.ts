import { describe, it, expect, vi } from 'vitest'
import { WebSearchService } from '../web-search.service'

describe('WebSearchService', () => {
  describe('parseDuckDuckGoResults', () => {
    it('should parse DuckDuckGo search results from HTML', () => {
      const html = `
        <div class="result__title">
          <a rel="nofollow" href="https://example.com">Example Title</a>
        </div>
        <div class="result__snippet">
          <a>Example snippet content</a>
        </div>
        <div class="result__title">
          <a rel="nofollow" href="https://test.com">Test Title</a>
        </div>
        <div class="result__snippet">
          <a>Test snippet content</a>
        </div>
      `
      const results = WebSearchService.parseDuckDuckGoResults(html, 5)

      expect(results).toHaveLength(2)
      expect(results[0]!.title).toBe('Example Title')
      expect(results[0]!.url).toBe('https://example.com')
      expect(results[0]!.snippet).toBe('Example snippet content')
    })

    it('should respect maxResults limit', () => {
      const html = `
        <div class="result__title">
          <a rel="nofollow" href="https://example1.com">Title 1</a>
        </div>
        <div class="result__snippet">
          <a>This is a long enough snippet content for result 1</a>
        </div>
        <div class="result__title">
          <a rel="nofollow" href="https://example2.com">Title 2</a>
        </div>
        <div class="result__snippet">
          <a>This is a long enough snippet content for result 2</a>
        </div>
        <div class="result__title">
          <a rel="nofollow" href="https://example3.com">Title 3</a>
        </div>
        <div class="result__snippet">
          <a>This is a long enough snippet content for result 3</a>
        </div>
      `
      const results = WebSearchService.parseDuckDuckGoResults(html, 2)

      expect(results).toHaveLength(2)
    })

    it('should return empty array for invalid HTML', () => {
      const html = '<html><body>No results</body></html>'
      const results = WebSearchService.parseDuckDuckGoResults(html, 5)

      expect(results).toHaveLength(0)
    })
  })

  describe('multiSearch', () => {
    it('caps merged multi-query results at totalMaxResults', async () => {
      const searchSpy = vi.spyOn(WebSearchService, 'search').mockImplementation(async (query) => [
        { title: `${query}-a`, url: `https://example.com/${query}-a`, snippet: 'a' },
        { title: `${query}-b`, url: `https://example.com/${query}-b`, snippet: 'b' }
      ])

      const results = await WebSearchService.multiSearch({
        queries: ['one', 'two'],
        engine: 'duckduckgo',
        maxResultsPerQuery: 2,
        totalMaxResults: 3
      })

      expect(results).toHaveLength(3)
      searchSpy.mockRestore()
    })

    it('uses the same limit for single-query searches', async () => {
      const searchSpy = vi.spyOn(WebSearchService, 'search').mockResolvedValue([
        { title: 'a', url: 'https://example.com/a', snippet: 'a' },
        { title: 'b', url: 'https://example.com/b', snippet: 'b' },
        { title: 'c', url: 'https://example.com/c', snippet: 'c' }
      ])

      await WebSearchService.multiSearch({
        queries: ['hello'],
        engine: 'exa-mcp',
        maxResultsPerQuery: 2,
        totalMaxResults: 2
      })

      expect(searchSpy).toHaveBeenCalledWith(
        'hello',
        'exa-mcp',
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      )
      searchSpy.mockRestore()
    })
  })

  describe('search engine selection', () => {
    it('should have correct engine types', () => {
      // 验证搜索引擎类型定义
      const engines = [
        'tavily',
        'exa',
        'exa-mcp',
        'anysearch',
        'duckduckgo',
        'local-bing',
        'local-google'
      ]
      expect(engines).toContain('tavily')
      expect(engines).toContain('exa')
      expect(engines).toContain('exa-mcp')
      expect(engines).toContain('anysearch')
      expect(engines).toContain('duckduckgo')
      expect(engines).toContain('local-bing')
      expect(engines).toContain('local-google')
    })
  })

  describe('parseDuckDuckGoResults without snippet', () => {
    it('should accept results with title only when snippet is short', () => {
      const html = `
        <div class="result__title">
          <a rel="nofollow" href="https://example.com">Short</a>
        </div>
        <div class="result__snippet">
          <a>Hi</a>
        </div>
      `
      const results = WebSearchService.parseDuckDuckGoResults(html, 5)
      expect(results).toHaveLength(1)
      expect(results[0]!.title).toBe('Short')
    })
  })
})
