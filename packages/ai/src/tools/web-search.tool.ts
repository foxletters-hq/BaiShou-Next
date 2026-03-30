/**
 * WebSearchTool — AI 可调用的网络搜索工具
 *
 * 通过外部搜索 API 获取搜索结果，让 AI 获取实时互联网信息。
 * 支持 Multi-Query：AI 可以同时提交多个查询词。
 *
 * 注意：搜索引擎后端（Tavily/DuckDuckGo）由宿主层通过 ToolContext 注入。
 * 工具本身只负责参数解析和结果格式化。
 *
 * 原始实现：lib/agent/tools/search/web_search_tool.dart (341 行)
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

/** 搜索结果接口——由宿主层实现 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** 网络搜索后端接口——通过 ToolContext 注入 */
export interface WebSearchBackend {
  search(query: string, maxResults: number): Promise<WebSearchResult[]>;
}

const webSearchParams = z.object({
  queries: z
    .array(z.string())
    .describe(
      'A list of 1-3 search queries with different angles/keywords. ' +
        'Using multiple queries greatly improves result diversity.',
    ),
});

export class WebSearchTool extends AgentTool<typeof webSearchParams> {
  private readonly searchBackend?: WebSearchBackend;

  constructor(searchBackend?: WebSearchBackend) {
    super();
    this.searchBackend = searchBackend;
  }

  readonly name = 'web_search';

  readonly description =
    'Search the internet for current information, news, and real-time data. ' +
    'Use this when the user asks about recent events, current facts, or anything ' +
    'that requires up-to-date information beyond your training data.\n\n' +
    "IMPORTANT: This tool searches the PUBLIC INTERNET only. " +
    "Do NOT use this to search the user's personal diary entries — use diary_search for that.\n\n" +
    'Provide 2-3 search queries with different angles/keywords for comprehensive results. ' +
    'Results include clickable [title](url) citations — use the url_read tool to read specific pages in detail.';

  readonly parameters = webSearchParams;

  async execute(
    args: z.infer<typeof webSearchParams>,
    context: ToolContext,
  ): Promise<string> {
    const queries = args.queries
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    if (queries.length === 0) {
      return 'Error: At least one search query is required.';
    }

    const backend = this.searchBackend;
    if (!backend) {
      return '网络搜索后端未配置。请在设置中配置搜索 API。';
    }

    const maxResults =
      (context.userConfig?.['web_search_max_results'] as number | undefined) ?? 5;

    try {
      // Multi-Query 并行搜索
      const allSettled = await Promise.allSettled(
        queries.map((q) => backend.search(q, maxResults)),
      );

      // 去重合并
      const seen = new Set<string>();
      const results: WebSearchResult[] = [];

      for (const settled of allSettled) {
        if (settled.status === 'fulfilled') {
          for (const r of settled.value) {
            if (!seen.has(r.url)) {
              seen.add(r.url);
              results.push(r);
            }
          }
        }
      }

      if (results.length === 0) {
        return `No search results found for: ${queries.join(', ')}`;
      }

      // 格式化输出
      const lines: string[] = [
        `Search queries: ${queries.map((q) => `"${q}"`).join(', ')}`,
        `Found ${results.length} results:\n`,
      ];

      const maxLen =
        (context.userConfig?.['web_search_snippet_length'] as number | undefined) ?? 500;

      for (let i = 0; i < results.length; i++) {
        const r = results[i]!;
        lines.push(`[${i + 1}] [${r.title}](${r.url})`);

        let snippet = r.snippet;
        if (snippet.length > maxLen) {
          snippet =
            snippet.slice(0, maxLen) +
            '... (truncated, use url_read for full text)';
        }
        lines.push(snippet);
        lines.push('');
      }

      lines.push(
        'Use [number](url) format to cite specific sources in your response. ' +
          'Use url_read for more details on specific pages.',
      );

      return lines.join('\n');
    } catch (e) {
      return `Web search failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
