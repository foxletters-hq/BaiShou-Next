import { logger } from '@baishou/shared'
import { LocalSearchProvider, type SearchItem } from './local-search-provider'

/**
 * Bing 本地搜索提供者
 * 使用隐藏的 BrowserWindow 加载 Bing 搜索页面并解析结果
 */
export class LocalBingProvider extends LocalSearchProvider {
  constructor() {
    super('local-bing', 'https://cn.bing.com/search?q=%s&ensearch=1')
  }

  /**
   * 解析 Bing 搜索结果 HTML
   */
  protected parseSearchResults(html: string): SearchItem[] {
    const results: SearchItem[] = []

    try {
      // 使用正则表达式解析 Bing 搜索结果
      // Bing 搜索结果在 #b_results 中，每个结果是 li.b_algo
      // 标题在 h2 > a 中
      
      // 匹配所有搜索结果项
      const itemRegex = /<li class="b_algo"[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi
      let match

      while ((match = itemRegex.exec(html)) !== null) {
        const url = match[1]
        const title = match[2].replace(/<[^>]+>/g, '').trim()

        if (url && title && (url.startsWith('http') || url.startsWith('https'))) {
          results.push({
            title,
            url: this.decodeBingUrl(url)
          })
        }
      }

      // 如果正则没有匹配到，尝试备用解析方式
      if (results.length === 0) {
        // 备用：匹配所有 h2 标签中的链接
        const fallbackRegex = /<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi
        while ((match = fallbackRegex.exec(html)) !== null) {
          const url = match[1]
          const title = match[2].replace(/<[^>]+>/g, '').trim()

          if (url && title && (url.startsWith('http') || url.startsWith('https'))) {
            results.push({
              title,
              url: this.decodeBingUrl(url)
            })
          }
        }
      }
    } catch (error) {
      logger.error('[LocalBingProvider] Failed to parse Bing search HTML:', error)
    }

    return results
  }

  /**
   * 解码 Bing 重定向 URL 获取真实 URL
   * Bing URL 格式: https://www.bing.com/ck/a?...&u=a1aHR0cHM6Ly93d3cudG91dGlhby5jb20...
   * 'u' 参数包含 Base64 编码的 URL，带有 'a1' 前缀
   */
  private decodeBingUrl(bingUrl: string): string {
    try {
      const url = new URL(bingUrl)
      const encodedUrl = url.searchParams.get('u')

      if (!encodedUrl) {
        return bingUrl
      }

      // 移除 'a1' 前缀并解码 Base64
      const base64Part = encodedUrl.substring(2)
      const decodedUrl = atob(base64Part)

      // 验证解码后的 URL
      if (decodedUrl.startsWith('http')) {
        return decodedUrl
      }

      return bingUrl
    } catch (error) {
      logger.warn('[LocalBingProvider] Failed to decode Bing URL:', error)
      return bingUrl
    }
  }
}

export const localBingProvider = new LocalBingProvider()
