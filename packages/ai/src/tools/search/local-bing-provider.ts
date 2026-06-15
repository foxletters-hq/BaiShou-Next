import { logger } from '@baishou/shared'
import { resolveBingClickThroughUrl } from './bing-search-url.util'
import {
  LocalSearchProvider,
  LOCAL_SEARCH_MAX_URL_RESULTS,
  type SearchItem
} from './local-search-provider'

/**
 * Bing 本地搜索提供者
 * 使用隐藏的 BrowserWindow 加载 Bing 搜索页面并解析结果
 */
export class LocalBingProvider extends LocalSearchProvider {
  constructor(fetchSearchPageFn?: (url: string) => Promise<string>) {
    super('local-bing', 'https://cn.bing.com/search?q=%s&ensearch=1', fetchSearchPageFn)
  }

  protected buildSearchUrl(query: string, maxResults: number): string {
    const count = Math.min(Math.max(maxResults, 1), LOCAL_SEARCH_MAX_URL_RESULTS)
    return `https://cn.bing.com/search?q=${encodeURIComponent(query)}&ensearch=1&count=${count}`
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
      const itemRegex =
        /<li class="b_algo"[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi
      let match

      while ((match = itemRegex.exec(html)) !== null) {
        const url = match[1]!
        const title = match[2]!.replace(/<[^>]+>/g, '').trim()

        if (url && title && (url.startsWith('http') || url.startsWith('https'))) {
          results.push({
            title,
            url: resolveBingClickThroughUrl(url)
          })
        }
      }

      // 如果正则没有匹配到，尝试备用解析方式
      if (results.length === 0) {
        // 备用：匹配所有 h2 标签中的链接
        const fallbackRegex =
          /<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi
        while ((match = fallbackRegex.exec(html)) !== null) {
          const url = match[1]!
          const title = match[2]!.replace(/<[^>]+>/g, '').trim()

          if (url && title && (url.startsWith('http') || url.startsWith('https'))) {
            results.push({
              title,
              url: resolveBingClickThroughUrl(url)
            })
          }
        }
      }
    } catch (error: any) {
      logger.error('[LocalBingProvider] Failed to parse Bing search HTML:', error)
    }

    return results
  }
}

export const localBingProvider = new LocalBingProvider()
