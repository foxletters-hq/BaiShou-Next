import { HtmlToMarkdownConverter } from './html-to-markdown';
import { LocalBingProvider } from './local-bing-provider';
import { LocalGoogleProvider } from './local-google-provider';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export type SearchEngineType = 'tavily' | 'duckduckgo' | 'local-bing' | 'local-google';

/**
 * 搜索引擎分流网关及底层抓取器（无头实现）
 * 包含随机请求头反爬伪装及 Fallback 策略保护
 */
export class WebSearchService {
  private static readonly defaultMaxResults = 5;

  private static readonly userAgentPool = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
  ];

  private static get browserHeaders() {
    const ua = this.userAgentPool[Math.floor(Math.random() * this.userAgentPool.length)];
    return {
      'User-Agent': ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };
  }

  /**
   * 并行多查询防冗余清洗搜索 API
   */
  public static async multiSearch(params: {
    queries: string[];
    engine: SearchEngineType;
    maxResultsPerQuery?: number;
    totalMaxResults?: number;
    apiKey?: string;
    webSearchResultFetcher?: (url: string) => Promise<string>;
    fetchSearchPage?: (url: string) => Promise<string>;
  }): Promise<SearchResult[]> {
    const { 
      queries, engine, 
      maxResultsPerQuery = 5, totalMaxResults = 10, apiKey,
      webSearchResultFetcher,
      fetchSearchPage
    } = params;

    if (queries.length === 0) return [];
    if (queries.length === 1) {
      return this.search(queries[0]!, engine, totalMaxResults, apiKey, webSearchResultFetcher, fetchSearchPage);
    }

    const promises = queries.map(q => this.search(q, engine, maxResultsPerQuery, apiKey, webSearchResultFetcher, fetchSearchPage));
    const allResultsRaw = await Promise.allSettled(promises);
    
    const seen = new Set<string>();
    const merged: SearchResult[] = [];

    for (const settled of allResultsRaw) {
      if (settled.status === 'fulfilled') {
        for (const r of settled.value) {
          if (!seen.has(r.url)) {
            seen.add(r.url);
            merged.push(r);
          }
        }
      }
    }

    // 只保留配置的最高上限
    return merged.slice(0, totalMaxResults);
  }

  public static async search(
    query: string, 
    engine: SearchEngineType, 
    maxResults: number = this.defaultMaxResults,
    apiKey?: string,
    webSearchResultFetcher?: (url: string) => Promise<string>,
    fetchSearchPage?: (url: string) => Promise<string>
  ): Promise<SearchResult[]> {
    if (engine === 'duckduckgo') {
      return this.searchDuckDuckGo(query, maxResults);
    }
    if (engine === 'local-bing') {
      return this.searchLocalBing(query, maxResults, webSearchResultFetcher);
    }
    if (engine === 'local-google') {
      return this.searchLocalGoogle(query, maxResults, webSearchResultFetcher, fetchSearchPage);
    }
    return this.searchTavily(query, maxResults, apiKey);
  }

  // --- DuckDuckGo 骨灰级抓取器 (避开封禁方案) ---
  private static async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
    
    const maxRetries = 2; // DuckDuckGo 经常返回 403 或 202（流控）
    for (let i = 0; i <= maxRetries; i++) {
        try {
            const resp = await fetch(url, { headers: this.browserHeaders, signal: AbortSignal.timeout(10000) });
            if (resp.status !== 200) {
               if (i === maxRetries) throw new Error('DuckDuckGo blocked request. Status: ' + resp.status);
               await new Promise(r => setTimeout(r, 1000)); // sleep 缓刑
               continue;
            }
            const html = await resp.text();
            return this.parseDuckDuckGoResults(html, maxResults);
        } catch (e) {
          if (i === maxRetries) throw e;
        }
    }
    return [];
  }

  public static parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];
    const blocks = html.split('class="result__title"');

    for (let i = 1; i < blocks.length; i++) {
      if (results.length >= maxResults) break;
      const block = blocks[i] || '';

      // 强摘链接片段和标题：<a rel="nofollow" href="...url...">标题部分</a>
      const aTagStart = block.indexOf('<a');
      if (aTagStart === -1) continue;
      const aTagEnd = block.indexOf('</a>', aTagStart);
      if (aTagEnd === -1) continue;

      const aTag = block.substring(aTagStart, aTagEnd + 4);
      const urlMatch = /href="([^"]+)"/.exec(aTag);
      const rawUrl = urlMatch?.[1] || '';

      const titleMatch = />([\s\S]*?)<\/a>/.exec(aTag);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      // 解析结果 Snippet
      const snippetStart = block.indexOf('class="result__snippet"');
      let snippetRaw = '';
      if (snippetStart !== -1) {
        const snippetEnd = block.indexOf('</a>', snippetStart);
        if (snippetEnd !== -1) {
          const snipTag = block.substring(snippetStart, snippetEnd + 4);
          const sMatch = />([\s\S]*?)<\/a>/.exec(snipTag);
          snippetRaw = sMatch ? sMatch[1] : '';
        }
      }
      
      const snippetClean = snippetRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      let actualUrl = rawUrl;
      
      // DuckDuckGo 中的转义和跳板提取
      try {
         const uUrl = rawUrl.startsWith('//') ? 'https:' + rawUrl : rawUrl;
         const parsed = new URL(uUrl);
         if (parsed.searchParams.has('uddg')) {
             const uddg = parsed.searchParams.get('uddg');
             if (uddg) actualUrl = decodeURIComponent(uddg);
         }
      } catch (e) {
         // 解析错误则保持原样
      }

      if (actualUrl && title && snippetClean.length > 10) {
          // 由于部分 DuckDuckGo 搜出的标题和 Snippet 可能带有 HTML Entites
          // 此处复用刚写的 converter 强制 decode 它保证中文和符号没有烂在里面
          results.push({
             title: title.replace(/&#(\d+);|&[a-z]+;/g, m => HtmlToMarkdownConverter.convert(m)),
             url: actualUrl,
             snippet: snippetClean.replace(/&#(\d+);|&[a-z]+;/g, m => HtmlToMarkdownConverter.convert(m))
          });
      }
    }

    return results;
  }

  // --- Tavily RESTful 获取 ---
  private static async searchTavily(query: string, maxResults: number, apiKey?: string): Promise<SearchResult[]> {
    const cleanKey = (apiKey || '').replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
    if (!cleanKey) {
      throw new Error('Tavily API key is missing or invalid.');
    }

    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cleanKey
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: false,
      })
    });

    if (!resp.ok) {
       const text = await resp.text();
       throw new Error('Tavily search failed: ' + resp.status + ' ' + text);
    }

    const data = await resp.json() as any;
    const resultsRaw = Array.isArray(data.results) ? data.results : [];
    const results: SearchResult[] = [];

    for (const item of resultsRaw) {
       if (results.length >= maxResults) break;
       const t = item.title?.trim() || '';
       const u = item.url?.trim() || '';
       const c = item.content?.trim() || '';
       if (t && u) {
          results.push({ title: t, url: u, snippet: c });
       }
    }
    
    return results;
  }

  // --- 本地 Bing 搜索 ---
  private static async searchLocalBing(
    query: string, 
    maxResults: number,
    webSearchResultFetcher?: (url: string) => Promise<string>
  ): Promise<SearchResult[]> {
    try {
      const provider = new LocalBingProvider();
      const response = await provider.search(query, maxResults, webSearchResultFetcher);
      
      return response.results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.content.substring(0, 300) // 截取前300字符作为 snippet
      }));
    } catch (e) {
      console.error('[WebSearchService] Local Bing search failed:', e);
      throw new Error(`Local Bing search failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // --- 本地 Google 搜索 ---
  private static async searchLocalGoogle(
    query: string, 
    maxResults: number,
    webSearchResultFetcher?: (url: string) => Promise<string>,
    fetchSearchPage?: (url: string) => Promise<string>
  ): Promise<SearchResult[]> {
    try {
      const provider = new LocalGoogleProvider(fetchSearchPage);
      const response = await provider.search(query, maxResults, webSearchResultFetcher);
      
      return response.results.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.content.substring(0, 300) // 截取前300字符作为 snippet
      }));
    } catch (e) {
      console.error('[WebSearchService] Local Google search failed:', e);
      throw new Error(`Local Google search failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
