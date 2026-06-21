export interface WebSearchConfig {
  webSearchEngine: string
  webSearchMaxResults: number
  webSearchRagEnabled: boolean
  tavilyApiKey: string
  exaApiKey: string
  anysearchApiKey: string
  webSearchRagMaxChunks: number
  webSearchRagChunksPerSource: number
  webSearchPlainSnippetLength: number
}

export interface WebSearchSettingsViewProps {
  searchConfig: WebSearchConfig
  onSearchChange: (config: WebSearchConfig) => void
}

export interface SearchEngineOption {
  value: string
  titleKey: string
  titleFallback: string
  descKey: string
  descFallback: string
}

export const SEARCH_ENGINE_OPTIONS: SearchEngineOption[] = [
  {
    value: 'local-bing',
    titleKey: 'settings.web_search_engine_local_bing',
    titleFallback: 'Bing 本地搜索',
    descKey: 'settings.web_search_engine_local_bing_desc',
    descFallback: '使用本地浏览器搜索 Bing，无需 API 密钥'
  },
  {
    value: 'local-google',
    titleKey: 'settings.web_search_engine_local_google',
    titleFallback: 'Google 本地搜索',
    descKey: 'settings.web_search_engine_local_google_desc',
    descFallback: '使用本地浏览器搜索 Google，无需 API 密钥'
  },
  {
    value: 'duckduckgo',
    titleKey: 'settings.web_search_engine_duckduckgo',
    titleFallback: 'DuckDuckGo',
    descKey: 'settings.web_search_engine_duckduckgo_desc',
    descFallback: '完全免费的 HTML 爬虫搜索，无需 API Key。'
  },
  {
    value: 'tavily',
    titleKey: 'settings.web_search_engine_tavily',
    titleFallback: 'Tavily API',
    descKey: 'settings.web_search_engine_tavily_desc',
    descFallback: '需要配置 API Key，专为大模型打造的搜索引擎，响应快、稳定性高。'
  },
  {
    value: 'exa',
    titleKey: 'settings.web_search_engine_exa',
    titleFallback: 'Exa API',
    descKey: 'settings.web_search_engine_exa_desc',
    descFallback: '需要配置 API Key，面向 AI 的语义搜索引擎，结果质量高。'
  },
  {
    value: 'exa-mcp',
    titleKey: 'settings.web_search_engine_exa_mcp',
    titleFallback: 'Exa MCP',
    descKey: 'settings.web_search_engine_exa_mcp_desc',
    descFallback: '通过 Exa MCP Server 免费搜索，无需 API Key。'
  },
  {
    value: 'anysearch',
    titleKey: 'settings.web_search_engine_anysearch',
    titleFallback: 'AnySearch API',
    descKey: 'settings.web_search_engine_anysearch_desc',
    descFallback: '需要配置 API Key，面向 AI Agent 的统一搜索基础设施，免费账户每日 1000 次。'
  }
]
