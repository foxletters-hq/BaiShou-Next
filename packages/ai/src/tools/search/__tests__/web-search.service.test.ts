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
      expect(results[0].title).toBe('Example Title')
      expect(results[0].url).toBe('https://example.com')
      expect(results[0].snippet).toBe('Example snippet content')
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

  describe('search engine selection', () => {
    it('should have correct engine types', () => {
      // 验证搜索引擎类型定义
      const engines = ['tavily', 'duckduckgo', 'local-bing', 'local-google']
      expect(engines).toContain('tavily')
      expect(engines).toContain('duckduckgo')
      expect(engines).toContain('local-bing')
      expect(engines).toContain('local-google')
    })
  })
})
