import { logger, limitExecute } from '@baishou/shared'
import { DEFAULT_WEB_SEARCH_LIMITS, WEB_SEARCH_MAX_RESULTS_LIMIT } from './web-search-config.util'

/** 与桌面端 SearchService 窗口池并发一致 */
const LOCAL_SEARCH_CONTENT_CONCURRENCY = 4

export { WEB_SEARCH_MAX_RESULTS_LIMIT as LOCAL_SEARCH_MAX_URL_RESULTS }

export interface SearchItem {
  title: string
  url: string
}

export interface SearchResult {
  title: string
  url: string
  content: string
}

export interface LocalSearchResponse {
  query: string
  results: SearchResult[]
}

/**
 * 本地搜索提供者基类
 * 使用隐藏的 BrowserWindow 加载搜索引擎页面并解析结果
 */
export abstract class LocalSearchProvider {
  protected providerId: string
  protected searchUrl: string
  private fetchSearchPageFn?: (url: string) => Promise<string>

  constructor(
    providerId: string,
    searchUrl: string,
    fetchSearchPageFn?: (url: string) => Promise<string>
  ) {
    this.providerId = providerId
    this.searchUrl = searchUrl
    this.fetchSearchPageFn = fetchSearchPageFn
  }

  /**
   * 执行搜索
   */
  public async search(
    query: string,
    maxResults: number = DEFAULT_WEB_SEARCH_LIMITS.maxResults,
    webSearchResultFetcher?: (url: string) => Promise<string>,
    plainSnippetLength?: number
  ): Promise<LocalSearchResponse> {
    try {
      if (!query.trim()) {
        throw new Error('Search query cannot be empty')
      }

      // 构建搜索 URL（含结果数量参数）
      const searchUrl = this.buildSearchUrl(query, maxResults)
      logger.info(`[LocalSearchProvider] Searching: ${searchUrl}`)

      // 使用 IPC 调用主进程的 SearchService
      const html = await this.fetchSearchPage(searchUrl)

      // 解析搜索结果
      const searchItems = this.parseSearchResults(html)
      logger.info(`[LocalSearchProvider] Found ${searchItems.length} search results`)

      // 限制结果数量
      const limitedItems = searchItems.slice(0, maxResults)
      const snippetLimit = plainSnippetLength ?? DEFAULT_WEB_SEARCH_LIMITS.plainSnippetLength

      // 并行抓取各结果页（主进程侧有并发上限）
      const fetched = await limitExecute(
        limitedItems,
        LOCAL_SEARCH_CONTENT_CONCURRENCY,
        async (item) => {
          try {
            const content = webSearchResultFetcher
              ? await webSearchResultFetcher(item.url)
              : await this.fetchPageContent(item.url)

            if (!content || content.startsWith('Failed to read URL')) {
              return null
            }

            return {
              title: item.title,
              url: item.url,
              content: this.truncateContent(content, snippetLimit)
            } satisfies SearchResult
          } catch {
            return null
          }
        }
      )

      const results = fetched.filter((r): r is SearchResult => r !== null)

      return {
        query,
        results
      }
    } catch (e: any) {
      logger.error(`[LocalSearchProvider] Search failed:`, e)
      throw e
    }
  }

  /**
   * 构建搜索 URL
   */
  protected buildSearchUrl(query: string, _maxResults: number): string {
    return this.searchUrl.replace('%s', encodeURIComponent(query))
  }

  /**
   * 获取搜索页面 HTML
   */
  protected async fetchSearchPage(url: string): Promise<string> {
    // 优先使用注入的函数（主进程场景）
    if (this.fetchSearchPageFn) {
      return this.fetchSearchPageFn(url)
    }

    // 通过 IPC 调用主进程的 SearchService（渲染进程场景）
    if (typeof window !== 'undefined' && (window as any).electron) {
      const uid = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      try {
        const html = await (window as any).electron.ipcRenderer.invoke('search:open-url', uid, url)
        return html
      } finally {
        await (window as any).electron.ipcRenderer.invoke('search:close-window', uid)
      }
    }
    throw new Error('Electron IPC not available')
  }

  /**
   * 获取页面内容
   */
  protected async fetchPageContent(url: string): Promise<string> {
    // 通过 IPC 调用主进程的 webSearchResultFetcher
    if (typeof window !== 'undefined' && (window as any).electron) {
      return await (window as any).electron.ipcRenderer.invoke('search:fetch-content', url)
    }
    throw new Error('Electron IPC not available')
  }

  /**
   * 解析搜索结果（子类实现）
   */
  protected abstract parseSearchResults(html: string): SearchItem[]

  /**
   * 截断内容
   */
  protected truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content
    }
    return content.substring(0, maxLength) + '... (truncated)'
  }
}
