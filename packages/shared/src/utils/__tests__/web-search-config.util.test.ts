import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WEB_SEARCH_LIMITS,
  resolveWebSearchLimits,
  webSearchConfigToUserConfig
} from '../web-search-config.util'

describe('web-search-config.util', () => {
  it('maps stored camelCase config to snake_case userConfig', () => {
    const userConfig = webSearchConfigToUserConfig({
      webSearchEngine: 'local-bing',
      webSearchMaxResults: 8,
      webSearchRagEnabled: false,
      tavilyApiKey: 'tvly-test',
      exaApiKey: 'exa-test',
      anysearchApiKey: 'as-test',
      webSearchRagMaxChunks: 10,
      webSearchRagChunksPerSource: 3,
      webSearchPlainSnippetLength: 4500
    })

    expect(userConfig).toEqual({
      web_search_engine: 'local-bing',
      web_search_max_results: 8,
      web_search_rag_enabled: false,
      tavily_api_key: 'tvly-test',
      exa_api_key: 'exa-test',
      anysearch_api_key: 'as-test',
      web_search_rag_max_chunks: 10,
      web_search_rag_chunks_per_source: 3,
      web_search_plain_snippet_length: 4500
    })
  })

  it('falls back to defaults when stored config is missing', () => {
    expect(resolveWebSearchLimits(webSearchConfigToUserConfig(null))).toEqual({
      plainSnippetLength: DEFAULT_WEB_SEARCH_LIMITS.plainSnippetLength,
      ragMaxChunks: DEFAULT_WEB_SEARCH_LIMITS.ragMaxChunks,
      ragChunksPerSource: DEFAULT_WEB_SEARCH_LIMITS.ragChunksPerSource,
      maxResults: DEFAULT_WEB_SEARCH_LIMITS.maxResults
    })
  })

  it('resolves limits from userConfig for Agent tools', () => {
    const limits = resolveWebSearchLimits(
      webSearchConfigToUserConfig({
        webSearchPlainSnippetLength: 6200,
        webSearchMaxResults: 6,
        webSearchRagMaxChunks: 15,
        webSearchRagChunksPerSource: 5
      })
    )

    expect(limits).toEqual({
      plainSnippetLength: 6200,
      ragMaxChunks: 15,
      ragChunksPerSource: 5,
      maxResults: 6
    })
  })
})
