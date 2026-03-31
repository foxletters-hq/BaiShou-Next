import { z } from 'zod';
import { AgentTool, ToolContext, ToolConfigParam } from './agent.tool';
import { WebSearchService, SearchEngineType, SearchResult } from './search/web-search.service';
import { SearchRagService } from './search/search-rag.service';

const webSearchParams = z.object({
  queries: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe(
      'A list of 1-3 search queries with different angles/keywords. ' +
      'Using multiple queries greatly improves result diversity and comprehensiveness. ' +
      'Example: ["latest Flutter 4.0 features", "Flutter 4.0 migration guide"]'
    ),
});

export class WebSearchTool extends AgentTool<typeof webSearchParams> {
  readonly name = 'web_search';

  readonly description =
    'Search the internet for current information, news, and real-time data. ' +
    'Use this when the user asks about recent events, current facts, or anything ' +
    'that requires up-to-date information beyond your training data.\n\n' +
    'IMPORTANT: This tool searches the PUBLIC INTERNET only. ' +
    "Do NOT use this to search the user's personal diary entries — use diary_search for that.\n\n" +
    'You should provide 2-3 search queries with different angles/keywords ' +
    'to get comprehensive results. For example, if the user asks about "iPhone 16 vs Samsung S25", ' +
    'you could search ["iPhone 16 specs review", "Samsung S25 specs review", "iPhone 16 vs Samsung S25 comparison"].\n\n' +
    'Results include clickable [title](url) citations — use the url_read tool to read specific pages in detail.';

  readonly parameters = webSearchParams;

  get icon(): string {
    return 'travel_explore';
  }

  get showInSettings(): boolean {
    return false; // 由于设置页有统一的网络管理区
  }

  // 暴露给 Gamma 层的工具用户参数配置，这些参数将在 ToolContext 的 userConfig 中回传！
  get configurableParams(): ToolConfigParam[] {
    return [
      {
        key: 'web_search_engine',
        label: 'Search Engine',
        type: 'enum',
        defaultValue: 'duckduckgo',
        enumOptions: [
          { label: 'DuckDuckGo (Free / No Key Required)', value: 'duckduckgo' },
          { label: 'Tavily (Requires API Key)', value: 'tavily' }
        ] // 老白守支持的两大内置引擎适配
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
    ];
  }

  async execute(
    args: z.infer<typeof webSearchParams>,
    context: ToolContext,
  ): Promise<string> {
    const queries = args.queries.map((q) => q.trim()).filter(Boolean);
    if (queries.length === 0) return 'Error: At least one search query is required.';

    const engineStr = (context.userConfig?.['web_search_engine'] as SearchEngineType | undefined) || 'duckduckgo';
    const maxResults = (context.userConfig?.['web_search_max_results'] as number | undefined) || 5;
    const ragEnabled = (context.userConfig?.['web_search_rag_enabled'] as boolean | undefined) !== false;
    const tavilyKey = context.userConfig?.['tavily_api_key'] as string | undefined;

    try {
       // 1. 无头获取引擎数据（如果有电子端代理 `webSearchResultFetcher` 则走之，否则走内置 Node API）
       // 我们将它做在了 WebSearchService.multiSearch 里了，自带并发处理！
       // 如果由于被封禁导致 duckduckgo 不行，尝试 fallback 降维方案
       let actualEngine = engineStr;
       let results: SearchResult[] = [];

       try {
           results = await WebSearchService.multiSearch({
              queries, engine: actualEngine, 
              maxResultsPerQuery: maxResults, 
              totalMaxResults: maxResults + 5,
              apiKey: tavilyKey
           });
       } catch (primaryErr) {
           console.warn(`[WebSearchTool] Primary engine ${actualEngine} failed, trying fallback. Error:`, primaryErr);
           actualEngine = actualEngine === 'tavily' ? 'duckduckgo' : 'tavily';
           results = await WebSearchService.multiSearch({
              queries, engine: actualEngine, 
              maxResultsPerQuery: maxResults, 
              totalMaxResults: maxResults,
              apiKey: tavilyKey
           });
       }

       if (results.length === 0) {
           return `No search results found for: ${queries.join(', ')}`;
       }

       // 2. RAG 切分降维 （可选启用且具有可用服务）
       if (ragEnabled && context.embeddingService?.isConfigured) {
          const compressed = await SearchRagService.compress({
              query: queries[0]!, 
              results: results.map(r => ({ title: r.title, url: r.url, content: r.snippet })),
              embeddingService: context.embeddingService,
              totalMaxChunks: maxResults
          });
          
          if (compressed.length > 0) {
              const buf: string[] = [
                 `Search queries: ${queries.map(q => `"${q}"`).join(', ')}`,
                 `Found ${results.length} results, RAG-compressed to ${compressed.length} relevant sources:\n`
              ];
              compressed.forEach((r, i) => {
                 buf.push(`[${i+1}] [${r.title}](${r.url})`);
                 buf.push(`Relevance: ${(r.avgScore * 100).toFixed(1)}%`);
                 buf.push(r.content);
                 buf.push('');
              });
              buf.push('These results have been semantically filtered for relevance. Use [number](url) to cite sources.');
              return buf.join('\n');
          }
       }

       // 3. Fallback 到朴素无 RAG 格式化输出
       return this.formatPlainResults(queries, results, actualEngine);
    } catch (e) {
       return `Web search failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private formatPlainResults(queries: string[], results: SearchResult[], engine: string): string {
     const engineName = engine === 'tavily' ? 'Tavily API' : 'DuckDuckGo';
     const buf: string[] = [
       `Search queries: ${queries.map(q => `"${q}"`).join(', ')}`,
       `Found ${results.length} results (via ${engineName}):\n`
     ];
     results.forEach((r, i) => {
       buf.push(`[${i+1}] [${r.title}](${r.url})`);
       let snippet = r.snippet;
       if (snippet.length > 600) {
         snippet = snippet.slice(0, 600) + '... (truncated, use url_read for full text)';
       }
       buf.push(snippet + '\n');
     });
     buf.push('Use [number](url) format to cite specific sources in your response. Use url_read for more details on specific pages.');
     return buf.join('\n');
  }
}
