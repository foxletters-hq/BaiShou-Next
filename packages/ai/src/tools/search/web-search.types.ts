export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export type SearchEngineType =
  | 'tavily'
  | 'exa'
  | 'exa-mcp'
  | 'anysearch'
  | 'duckduckgo'
  | 'local-bing'
  | 'local-google'

/** 单次搜索诊断信息，便于排查「无结果」问题 */
export interface SearchDiagnostics {
  engine: SearchEngineType
  query: string
  httpStatus?: number
  htmlBytes?: number
  parsedCount?: number
  error?: string
  detail?: string
}
