import { logger } from '@baishou/shared'
import { searchExaMcp } from './exa-mcp-search'
import { LocalBingProvider } from './local-bing-provider'
import { LocalGoogleProvider } from './local-google-provider'
import { DEFAULT_WEB_SEARCH_LIMITS } from './web-search-config.util'
import { truncateSearchSnippet } from './web-content.util'
import { parseDuckDuckGoResults, searchDuckDuckGo } from './web-search-duckduckgo'
import { searchAnysearch, searchExa, searchTavily } from './web-search-remote-api'
import type { SearchDiagnostics, SearchEngineType, SearchResult } from './web-search.types'

export type { SearchDiagnostics, SearchEngineType, SearchResult } from './web-search.types'

/**
 * 搜索引擎分流网关及底层抓取器（无头实现）
 * 包含随机请求头反爬伪装及 Fallback 策略保护
 */
export class WebSearchService {
  private static readonly defaultMaxResults = DEFAULT_WEB_SEARCH_LIMITS.maxResults

  public static parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
    return parseDuckDuckGoResults(html, maxResults)
  }

  /**
   * 并行多查询防冗余清洗搜索 API
   */
  public static async multiSearch(params: {
    queries: string[]
    engine: SearchEngineType
    maxResultsPerQuery?: number
    totalMaxResults?: number
    apiKey?: string
    exaApiKey?: string
    anysearchApiKey?: string
    webSearchResultFetcher?: (url: string) => Promise<string>
    fetchSearchPage?: (url: string) => Promise<string>
    plainSnippetLength?: number
    onDiagnostics?: (diag: SearchDiagnostics) => void
  }): Promise<SearchResult[]> {
    const {
      queries,
      engine,
      maxResultsPerQuery = DEFAULT_WEB_SEARCH_LIMITS.maxResults,
      totalMaxResults = maxResultsPerQuery,
      apiKey,
      exaApiKey,
      anysearchApiKey,
      webSearchResultFetcher,
      fetchSearchPage,
      plainSnippetLength,
      onDiagnostics
    } = params

    if (queries.length === 0) return []
    if (queries.length === 1) {
      return this.search(
        queries[0]!,
        engine,
        totalMaxResults,
        apiKey,
        exaApiKey,
        anysearchApiKey,
        webSearchResultFetcher,
        fetchSearchPage,
        plainSnippetLength,
        onDiagnostics
      )
    }

    const promises = queries.map((q) =>
      this.search(
        q,
        engine,
        maxResultsPerQuery,
        apiKey,
        exaApiKey,
        anysearchApiKey,
        webSearchResultFetcher,
        fetchSearchPage,
        plainSnippetLength,
        onDiagnostics
      )
    )
    const allResultsRaw = await Promise.allSettled(promises)

    const seen = new Set<string>()
    const merged: SearchResult[] = []

    for (const settled of allResultsRaw) {
      if (settled.status === 'fulfilled') {
        for (const r of settled.value) {
          if (!seen.has(r.url)) {
            seen.add(r.url)
            merged.push(r)
          }
        }
      }
    }

    return merged.slice(0, totalMaxResults)
  }

  public static async search(
    query: string,
    engine: SearchEngineType,
    maxResults: number = this.defaultMaxResults,
    apiKey?: string,
    exaApiKey?: string,
    anysearchApiKey?: string,
    webSearchResultFetcher?: (url: string) => Promise<string>,
    fetchSearchPage?: (url: string) => Promise<string>,
    plainSnippetLength?: number,
    onDiagnostics?: (diag: SearchDiagnostics) => void
  ): Promise<SearchResult[]> {
    logger.info(
      `[WebSearchService] search engine=${engine} query="${query}" maxResults=${maxResults}`
    )

    if (engine === 'duckduckgo') {
      return searchDuckDuckGo(query, maxResults, onDiagnostics)
    }
    if (engine === 'exa') {
      return searchExa(query, maxResults, exaApiKey, onDiagnostics)
    }
    if (engine === 'exa-mcp') {
      return searchExaMcp(query, maxResults, onDiagnostics, plainSnippetLength)
    }
    if (engine === 'anysearch') {
      return searchAnysearch(query, maxResults, anysearchApiKey, onDiagnostics)
    }
    if (engine === 'local-bing') {
      return this.searchLocalBing(
        query,
        maxResults,
        webSearchResultFetcher,
        fetchSearchPage,
        plainSnippetLength
      )
    }
    if (engine === 'local-google') {
      return this.searchLocalGoogle(
        query,
        maxResults,
        webSearchResultFetcher,
        fetchSearchPage,
        plainSnippetLength
      )
    }
    return searchTavily(query, maxResults, apiKey, onDiagnostics)
  }

  private static async searchLocalBing(
    query: string,
    maxResults: number,
    webSearchResultFetcher?: (url: string) => Promise<string>,
    fetchSearchPage?: (url: string) => Promise<string>,
    plainSnippetLength?: number
  ): Promise<SearchResult[]> {
    try {
      const provider = new LocalBingProvider(fetchSearchPage)
      const response = await provider.search(
        query,
        maxResults,
        webSearchResultFetcher,
        plainSnippetLength
      )

      return response.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: truncateSearchSnippet(
          r.content,
          plainSnippetLength ?? DEFAULT_WEB_SEARCH_LIMITS.plainSnippetLength
        )
      }))
    } catch (e) {
      console.error('[WebSearchService] Local Bing search failed:', e)
      throw new Error(`Local Bing search failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  private static async searchLocalGoogle(
    query: string,
    maxResults: number,
    webSearchResultFetcher?: (url: string) => Promise<string>,
    fetchSearchPage?: (url: string) => Promise<string>,
    plainSnippetLength?: number
  ): Promise<SearchResult[]> {
    try {
      const provider = new LocalGoogleProvider(fetchSearchPage)
      const response = await provider.search(
        query,
        maxResults,
        webSearchResultFetcher,
        plainSnippetLength
      )

      return response.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: truncateSearchSnippet(
          r.content,
          plainSnippetLength ?? DEFAULT_WEB_SEARCH_LIMITS.plainSnippetLength
        )
      }))
    } catch (e) {
      console.error('[WebSearchService] Local Google search failed:', e)
      throw new Error(`Local Google search failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}
