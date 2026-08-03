import { describe, it, expect } from 'vitest'
import { fetchUrlAsMarkdown } from '../url-to-markdown'
import { EMPTY_WEB_PAGE_MESSAGE } from '../web-content.util'

describe('fetchUrlAsMarkdown', () => {
  it('将 HTML 转为 markdown 并提取标题', async () => {
    const html = `<!doctype html><html><head><title>Hello Doc</title></head>
<body><h1>Title</h1><p>Alpha <strong>beta</strong></p></body></html>`

    const result = await fetchUrlAsMarkdown('https://example.com/page', {
      fetchImpl: async () =>
        ({
          ok: true,
          status: 200,
          statusText: 'OK',
          url: 'https://example.com/page',
          headers: { get: () => 'text/html; charset=utf-8' },
          text: async () => html
        }) as unknown as Response
    })

    expect(result.title).toBe('Hello Doc')
    expect(result.markdown).toContain('# Title')
    expect(result.markdown).toContain('Alpha')
    expect(result.markdown).toContain('beta')
  })

  it('空页面返回占位文案', async () => {
    const result = await fetchUrlAsMarkdown('https://example.com/empty', {
      fetchImpl: async () =>
        ({
          ok: true,
          status: 200,
          statusText: 'OK',
          url: 'https://example.com/empty',
          headers: { get: () => 'text/html' },
          text: async () => '<html><body><script>x</script></body></html>'
        }) as unknown as Response
    })
    expect(result.markdown).toBe(EMPTY_WEB_PAGE_MESSAGE)
  })

  it('HTTP 失败时抛错', async () => {
    await expect(
      fetchUrlAsMarkdown('https://example.com/404', {
        fetchImpl: async () =>
          ({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            headers: { get: () => null },
            text: async () => ''
          }) as unknown as Response
      })
    ).rejects.toThrow(/404/)
  })

  it('拦截私网 URL（SSRF）', async () => {
    await expect(
      fetchUrlAsMarkdown('http://127.0.0.1/secret', {
        fetchImpl: async () => {
          throw new Error('should not fetch')
        }
      })
    ).rejects.toThrow(/private|local/i)

    await expect(
      fetchUrlAsMarkdown('http://192.168.1.1/', {
        fetchImpl: async () => {
          throw new Error('should not fetch')
        }
      })
    ).rejects.toThrow(/private|local/i)
  })
})
