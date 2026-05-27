import type { WebSearchConfig } from '../types/settings.types'

/** Defaults aligned with `DEFAULT_WEB_SEARCH_CONFIG` in settings. */
export const DEFAULT_WEB_SEARCH_LIMITS = {
  plainSnippetLength: 3000,
  ragMaxChunks: 12,
  ragChunksPerSource: 4,
  maxResults: 5
} as const

export type WebSearchLimits = {
  plainSnippetLength: number
  ragMaxChunks: number
  ragChunksPerSource: number
  maxResults: number
}

function readNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return fallback
}

/** Resolve web search length limits from ToolContext.userConfig (snake_case keys). */
export function resolveWebSearchLimits(userConfig?: Record<string, unknown>): WebSearchLimits {
  return {
    plainSnippetLength: readNumber(
      userConfig?.web_search_plain_snippet_length,
      DEFAULT_WEB_SEARCH_LIMITS.plainSnippetLength
    ),
    ragMaxChunks: readNumber(
      userConfig?.web_search_rag_max_chunks,
      DEFAULT_WEB_SEARCH_LIMITS.ragMaxChunks
    ),
    ragChunksPerSource: readNumber(
      userConfig?.web_search_rag_chunks_per_source,
      DEFAULT_WEB_SEARCH_LIMITS.ragChunksPerSource
    ),
    maxResults: readNumber(
      userConfig?.web_search_max_results,
      DEFAULT_WEB_SEARCH_LIMITS.maxResults
    )
  }
}

/** Map persisted WebSearchConfig (camelCase) to userConfig snake_case fields. */
export function webSearchConfigToUserConfig(
  webSearchConfig?: Partial<WebSearchConfig> | null
): Record<string, unknown> {
  return {
    web_search_engine: webSearchConfig?.webSearchEngine || 'duckduckgo',
    web_search_max_results:
      webSearchConfig?.webSearchMaxResults ?? DEFAULT_WEB_SEARCH_LIMITS.maxResults,
    web_search_rag_enabled: webSearchConfig?.webSearchRagEnabled ?? true,
    tavily_api_key: webSearchConfig?.tavilyApiKey || '',
    web_search_rag_max_chunks:
      webSearchConfig?.webSearchRagMaxChunks ?? DEFAULT_WEB_SEARCH_LIMITS.ragMaxChunks,
    web_search_rag_chunks_per_source:
      webSearchConfig?.webSearchRagChunksPerSource ??
      DEFAULT_WEB_SEARCH_LIMITS.ragChunksPerSource,
    web_search_plain_snippet_length:
      webSearchConfig?.webSearchPlainSnippetLength ?? DEFAULT_WEB_SEARCH_LIMITS.plainSnippetLength
  }
}
