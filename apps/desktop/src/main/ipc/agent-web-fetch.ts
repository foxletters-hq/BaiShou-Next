import { net } from 'electron'
import { htmlToPlainText, EMPTY_WEB_PAGE_MESSAGE, UNAVAILABLE_WEB_PAGE_MESSAGE } from '@baishou/ai'
import { logger } from '@baishou/shared'
import { searchService } from '../services/search.service'

const WEB_FETCH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchUrlHtmlViaBrowserWindow(url: string): Promise<string> {
  const uid = `fetch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  try {
    return await searchService.openUrlInSearchWindow(uid, url)
  } finally {
    await searchService.closeSearchWindow(uid)
  }
}

async function fetchUrlHtmlViaNet(url: string): Promise<string> {
  const response = await net.fetch(url, {
    headers: { 'User-Agent': WEB_FETCH_USER_AGENT }
  })

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} - ${response.statusText}`)
  }

  return response.text()
}

/**
 * 创建网页内容获取器。
 * 负责抓取并转换为正文，不在此处截断长度；
 * 截取长度由设置项 webSearchPlainSnippetLength 经 userConfig 注入到 url_read / web_search 工具。
 */
export function createWebSearchResultFetcher() {
  return async (url: string): Promise<string> => {
    try {
      let html = ''
      try {
        html = await fetchUrlHtmlViaNet(url)
      } catch (netErr: any) {
        logger.warn(
          `[createWebSearchResultFetcher] net.fetch failed for ${url}, falling back to hidden BrowserWindow:`,
          netErr
        )
        html = await fetchUrlHtmlViaBrowserWindow(url)
      }

      const plainText = htmlToPlainText(html)
      return plainText || EMPTY_WEB_PAGE_MESSAGE
    } catch (e: any) {
      logger.debug(`Web fetch skipped for ${url}:`, e)
      return UNAVAILABLE_WEB_PAGE_MESSAGE
    }
  }
}

/**
 * 创建搜索页面获取函数，使用 SearchService 的 BrowserWindow 获取搜索结果页面
 */
export function createFetchSearchPage() {
  return async (url: string): Promise<string> => {
    const uid = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    try {
      const html = await searchService.openUrlInSearchWindow(uid, url)
      return html
    } finally {
      await searchService.closeSearchWindow(uid)
    }
  }
}
