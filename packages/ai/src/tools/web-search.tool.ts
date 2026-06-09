import { z } from 'zod'
import { AgentTool, ToolContext, ToolConfigParam } from './agent.tool'
import {
  WebSearchService,
  SearchEngineType,
  SearchResult,
  type SearchDiagnostics
} from './search/web-search.service'
import { SearchRagService } from './search/search-rag.service'
import { resolveWebSearchLimits } from './search/web-search-config.util'

const webSearchParams = z.object({
  queries: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe(
      'A list of 1-3 search queries with different angles/keywords. ' +
        'Using multiple queries greatly improves result diversity and comprehensiveness. ' +
        'Example: ["latest Flutter 4.0 features", "Flutter 4.0 migration guide"]'
    )
})

export class WebSearchTool extends AgentTool<typeof webSearchParams> {
  readonly name = 'web_search'

  readonly description =
    'Search the internet for current information, news, and real-time data. ' +
    'Use this when the user asks about recent events, current facts, or anything ' +
    'that requires up-to-date information beyond your training data.\n\n' +
    'IMPORTANT: This tool searches the PUBLIC INTERNET only. ' +
    "Do NOT use this to search the user's personal diary entries — use diary_search for that.\n\n" +
    'You should provide 2-3 search queries with different angles/keywords ' +
    'to get comprehensive results. For example, if the user asks about "iPhone 16 vs Samsung S25", ' +
    'you could search ["iPhone 16 specs review", "Samsung S25 specs review", "iPhone 16 vs Samsung S25 comparison"].\n\n' +
    'Results include clickable [title](url) citations — use the url_read tool to read specific pages in detail.'

  readonly parameters = webSearchParams

  get icon(): string {
    return 'travel_explore'
  }

  get showInSettings(): boolean {
    return false // 由于设置页有统一的网络管理区
  }

  // 暴露给 Gamma 层的工具用户参数配置，这些参数将在 ToolContext 的 userConfig 中回传！
  get configurableParams(): ToolConfigParam[] {
    return [
      {
        key: 'web_search_engine',
        label: 'Search Engine',
        type: 'enum',
        defaultValue: 'local-bing',
        enumOptions: [
          { label: 'Bing (Local Browser)', value: 'local-bing' },
          { label: 'Google (Local Browser)', value: 'local-google' },
          { label: 'DuckDuckGo (Free / No Key Required)', value: 'duckduckgo' },
          { label: 'Tavily (Requires API Key)', value: 'tavily' },
          { label: 'Exa (Requires API Key)', value: 'exa' },
          { label: 'Exa MCP (Free / No Key Required)', value: 'exa-mcp' },
          { label: 'AnySearch (Requires API Key)', value: 'anysearch' }
        ]
      },
      {
        key: 'tavily_api_key',
        label: 'Tavily API Key',
        type: 'string',
        defaultValue: '',
        isSecret: true,
        placeholder: 'tvly-xxxx...'
      },
      {
        key: 'exa_api_key',
        label: 'Exa API Key',
        type: 'string',
        defaultValue: '',
        isSecret: true,
        placeholder: 'exa-xxxx...'
      },
      {
        key: 'anysearch_api_key',
        label: 'AnySearch API Key',
        type: 'string',
        defaultValue: '',
        isSecret: true,
        placeholder: 'as-xxxx...'
      },
      {
        key: 'web_search_max_results',
        label: 'Max Results Per Query',
        type: 'number',
        defaultValue: 5
      },
      {
        key: 'web_search_rag_enabled',
        label: 'Enable RAG Compression (Require Embedding Model)',
        type: 'boolean',
        defaultValue: true
      }
    ]
  }

  async execute(args: z.infer<typeof webSearchParams>, context: ToolContext): Promise<string> {
    const queries = args.queries.map((q) => q.trim()).filter(Boolean)
    if (queries.length === 0) return 'Error: At least one search query is required.'

    const engineStr =
      (context.userConfig?.['web_search_engine'] as SearchEngineType | undefined) || 'exa-mcp'
    const limits = resolveWebSearchLimits(context.userConfig)
    const maxResults = limits.maxResults
    const ragEnabled =
      (context.userConfig?.['web_search_rag_enabled'] as boolean | undefined) !== false
    const tavilyKey = context.userConfig?.['tavily_api_key'] as string | undefined
    const exaKey = context.userConfig?.['exa_api_key'] as string | undefined
    const anysearchKey = context.userConfig?.['anysearch_api_key'] as string | undefined
    const diagnostics: SearchDiagnostics[] = []
    const onDiagnostics = (diag: SearchDiagnostics) => {
      diagnostics.push(diag)
    }

    try {
      // 1. 无头获取引擎数据（如果有电子端代理 `webSearchResultFetcher` 则走之，否则走内置 Node API）
      // 我们将它做在了 WebSearchService.multiSearch 里了，自带并发处理！
      // 如果由于被封禁导致 duckduckgo 不行，尝试 fallback 降维方案
      let actualEngine = engineStr
      let results: SearchResult[] = []

      const runSearch = (engine: SearchEngineType) =>
        WebSearchService.multiSearch({
          queries,
          engine,
          maxResultsPerQuery: maxResults,
          totalMaxResults: maxResults + 5,
          apiKey: tavilyKey,
          exaApiKey: exaKey,
          anysearchApiKey: anysearchKey,
          webSearchResultFetcher: context.webSearchResultFetcher,
          fetchSearchPage: context.fetchSearchPage,
          plainSnippetLength: limits.plainSnippetLength,
          onDiagnostics
        })

      try {
        results = await runSearch(actualEngine)
      } catch (primaryErr) {
        console.warn(
          `[WebSearchTool] Primary engine ${actualEngine} failed, trying fallback. Error:`,
          primaryErr
        )
        // 本地搜索引擎失败时不 fallback 到其他引擎
        if (actualEngine.startsWith('local-')) {
          throw primaryErr
        }
        const fallbacks = this.getFallbackEngines(actualEngine, tavilyKey, exaKey, anysearchKey)
        let lastErr: unknown = primaryErr
        for (const fb of fallbacks) {
          try {
            actualEngine = fb
            results = await runSearch(fb)
            lastErr = null
            break
          } catch (e) {
            lastErr = e
          }
        }
        if (lastErr) throw lastErr
      }

      if (results.length === 0) {
        return (
          `No search results found for: ${queries.join(', ')}\n\n` +
          this.formatDiagnostics(actualEngine, diagnostics)
        )
      }

      // 2. RAG 切分降维 （可选启用且具有可用服务）
      if (ragEnabled && context.embeddingService?.isConfigured) {
        const compressed = await SearchRagService.compress({
          query: queries[0]!,
          results: results.map((r) => ({
            title: r.title,
            url: r.url,
            content: r.snippet
          })),
          embeddingService: context.embeddingService,
          totalMaxChunks: limits.ragMaxChunks,
          chunksPerSource: limits.ragChunksPerSource
        })

        if (compressed.length > 0) {
          const buf: string[] = [
            `Search queries: ${queries.map((q) => `"${q}"`).join(', ')}`,
            `Found ${results.length} results, RAG-compressed to ${compressed.length} relevant sources:\n`
          ]
          compressed.forEach((r, i) => {
            buf.push(`[${i + 1}] [${r.title}](${r.url})`)
            buf.push(`Relevance: ${(r.avgScore * 100).toFixed(1)}%`)
            buf.push(r.content)
            buf.push('')
          })
          buf.push(
            'These results have been semantically filtered for relevance. Use [number](url) to cite sources.'
          )
          return buf.join('\n')
        }
      }

      // 3. Fallback 到朴素无 RAG 格式化输出
      return this.formatPlainResults(queries, results, actualEngine)
    } catch (e) {
      return `Web search failed: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  private getFallbackEngines(
    primary: SearchEngineType,
    tavilyKey?: string,
    exaKey?: string,
    anysearchKey?: string
  ): SearchEngineType[] {
    const hasKey = (key?: string) => Boolean((key || '').replace(/\s/g, '').trim())
    const candidates: SearchEngineType[] = []
    if (primary !== 'anysearch' && hasKey(anysearchKey)) candidates.push('anysearch')
    if (primary !== 'exa-mcp' && !primary.startsWith('local-')) candidates.push('exa-mcp')
    if (primary !== 'exa' && hasKey(exaKey)) candidates.push('exa')
    if (primary !== 'tavily' && hasKey(tavilyKey)) candidates.push('tavily')
    if (primary !== 'duckduckgo' && !primary.startsWith('local-')) candidates.push('duckduckgo')
    return candidates
  }

  private formatDiagnostics(engine: string, diagnostics: SearchDiagnostics[]): string {
    if (diagnostics.length === 0) {
      return `[Diagnostics] engine=${engine}, no detailed trace captured.`
    }
    const lines = diagnostics.map((d) => {
      const parts = [
        `engine=${d.engine}`,
        d.httpStatus !== undefined ? `http=${d.httpStatus}` : null,
        d.htmlBytes !== undefined ? `htmlBytes=${d.htmlBytes}` : null,
        d.parsedCount !== undefined ? `parsed=${d.parsedCount}` : null,
        d.error ? `error=${d.error}` : null,
        d.detail ? `detail=${d.detail}` : null
      ].filter(Boolean)
      return `- query="${d.query}": ${parts.join(', ')}`
    })
    return `[Diagnostics] lastEngine=${engine}\n${lines.join('\n')}`
  }

  private formatPlainResults(queries: string[], results: SearchResult[], engine: string): string {
    const engineNames: Record<string, string> = {
      tavily: 'Tavily API',
      exa: 'Exa API',
      'exa-mcp': 'Exa MCP',
      anysearch: 'AnySearch API',
      duckduckgo: 'DuckDuckGo',
      'local-bing': 'Bing Local',
      'local-google': 'Google Local'
    }
    const engineName = engineNames[engine] || engine
    const buf: string[] = [
      `Search queries: ${queries.map((q) => `"${q}"`).join(', ')}`,
      `Found ${results.length} results (via ${engineName}):\n`
    ]
    results.forEach((r, i) => {
      buf.push(`[${i + 1}] [${r.title}](${r.url})`)
      let snippet = r.snippet
      if (snippet.length > 600) {
        snippet = snippet.slice(0, 600) + '... (truncated, use url_read for full text)'
      }
      buf.push(snippet + '\n')
    })
    buf.push(
      'Use [number](url) format to cite specific sources in your response. Use url_read for more details on specific pages.'
    )
    return buf.join('\n')
  }
}
