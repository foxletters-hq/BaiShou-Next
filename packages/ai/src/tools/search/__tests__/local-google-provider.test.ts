import { describe, it, expect } from 'vitest'
import { LocalGoogleProvider } from '../local-google-provider'

describe('LocalGoogleProvider', () => {
  const provider = new LocalGoogleProvider()

  describe('parseSearchResults', () => {
    it('should parse Google search results from HTML', () => {
      const html = `
        <html>
          <body>
            <div class="g">
              <a href="https://example.com">
                <h3>Example Title</h3>
              </a>
            </div>
            <div class="g">
              <a href="https://test.com">
                <h3>Test Title</h3>
              </a>
            </div>
          </body>
        </html>
      `
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

    it('should filter out non-http URLs', () => {
      const html = `
        <html>
          <body>
            <div class="g">
              <a href="javascript:void(0)">
                <h3>JavaScript Link</h3>
              </a>
            </div>
            <div class="g">
              <a href="https://example.com">
                <h3>Valid Link</h3>
              </a>
            </div>
          </body>
        </html>
      `
      const results = (provider as any).parseSearchResults(html)
      
      expect(results).toHaveLength(1)
      expect(results[0].url).toBe('https://example.com')
    })
  })
})
