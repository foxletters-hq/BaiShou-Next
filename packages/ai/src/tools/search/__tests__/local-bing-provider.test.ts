import { describe, it, expect } from 'vitest'
import { LocalBingProvider } from '../local-bing-provider'

describe('LocalBingProvider', () => {
  const provider = new LocalBingProvider()

  describe('parseSearchResults', () => {
    it('should parse Bing search results from HTML', () => {
      const html = `
        <html>
          <body>
            <ol id="b_results">
              <li class="b_algo">
                <h2><a href="https://www.bing.com/ck/a?u=a1aHR0cHM6Ly9leGFtcGxlLmNvbQ==">Example Title</a></h2>
                <p>Example snippet</p>
              </li>
              <li class="b_algo">
                <h2><a href="https://www.bing.com/ck/a?u=a1aHR0cHM6Ly90ZXN0LmNvbQ==">Test Title</a></h2>
                <p>Test snippet</p>
              </li>
            </ol>
          </body>
        </html>
      `
      // 使用反射访问私有方法进行测试
      const results = (provider as any).parseSearchResults(html)
      
      expect(results).toHaveLength(2)
      expect(results[0].title).toBe('Example Title')
      expect(results[0].url).toBe('https://example.com')
      expect(results[1].title).toBe('Test Title')
      expect(results[1].url).toBe('https://test.com')
    })

    it('should return empty array for invalid HTML', () => {
      const html = '<html><body>No results</body></html>'
      const results = (provider as any).parseSearchResults(html)
      
      expect(results).toHaveLength(0)
    })

    it('should handle malformed HTML gracefully', () => {
      const html = '<div>malformed'
      const results = (provider as any).parseSearchResults(html)
      
      expect(results).toHaveLength(0)
    })
  })

  describe('decodeBingUrl', () => {
    it('should decode Bing redirect URL', () => {
      const bingUrl = 'https://www.bing.com/ck/a?u=a1aHR0cHM6Ly9leGFtcGxlLmNvbQ=='
      const decoded = (provider as any).decodeBingUrl(bingUrl)
      
      expect(decoded).toBe('https://example.com')
    })

    it('should return original URL if no u parameter', () => {
      const url = 'https://example.com'
      const result = (provider as any).decodeBingUrl(url)
      
      expect(result).toBe(url)
    })

    it('should return original URL if decoding fails', () => {
      const url = 'https://www.bing.com/ck/a?u=invalid'
      const result = (provider as any).decodeBingUrl(url)
      
      expect(result).toBe(url)
    })
  })
})
