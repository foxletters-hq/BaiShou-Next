import { logger } from '@baishou/shared'
import { LocalSearchProvider, type SearchItem } from './local-search-provider'

/**
 * Google 本地搜索提供者
 * 使用隐藏的 BrowserWindow 加载 Google 搜索页面并解析结果
 */
export class LocalGoogleProvider extends LocalSearchProvider {
  constructor(fetchSearchPageFn?: (url: string) => Promise<string>) {
    super('local-google', 'https://www.google.com/search?q=%s', fetchSearchPageFn)
  }

  /**
   * 解析 Google 搜索结果 HTML
   */
  protected parseSearchResults(html: string): SearchItem[] {
    const results: SearchItem[] = []

    try {
      // Google 搜索结果在 div.g 中，标题在 h3 中，链接在 a 中
      // 匹配所有搜索结果项
      const itemRegex = /<div class="g"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/gi
      let match

      while ((match = itemRegex.exec(html)) !== null) {
        const url = match[1]
        const title = match[2].replace(/<[^>]+>/g, '').trim()

        if (url && title && (url.startsWith('http') || url.startsWith('https'))) {
          results.push({
            title,
            url
          })
        }
      }

      // 如果正则没有匹配到，尝试备用解析方式
      if (results.length === 0) {
        // 备用：匹配所有 h3 标签中的链接
        const fallbackRegex = /<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/gi
        while ((match = fallbackRegex.exec(html)) !== null) {
          const url = match[1]
          const title = match[2].replace(/<[^>]+>/g, '').trim()

          if (url && title && (url.startsWith('http') || url.startsWith('https'))) {
            results.push({
              title,
              url
            })
          }
        }
      }

      // 再次备用：匹配所有包含 h3 的链接
      if (results.length === 0) {
        const lastResortRegex = /<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>[^<]*<h3[^>]*>([^<]*)<\/h3>/gi
        while ((match = lastResortRegex.exec(html)) !== null) {
          const url = match[1]
          const title = match[2].trim()

          if (url && title) {
            results.push({
              title,
              url
            })
          }
        }
      }
    } catch (error) {
      logger.error('[LocalGoogleProvider] Failed to parse Google search HTML:', error)
    }

    return results
  }
}

export const localGoogleProvider = new LocalGoogleProvider()
