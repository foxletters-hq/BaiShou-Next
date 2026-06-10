import { HtmlToMarkdownConverter } from './html-to-markdown'
import type { ToolEmbeddingService } from '../agent.tool'
import { SearchRagService } from './search-rag.service'
import { DEFAULT_WEB_SEARCH_LIMITS } from './web-search-config.util'

const TRUNCATION_SUFFIX = '\n\n[Content truncated due to length limits...]'

export const SEARCH_SNIPPET_TRUNCATION_SUFFIX = '... (truncated, use url_read for full text)'

/** Truncate a search result snippet before sending to the model or embedding APIs. */
export function truncateSearchSnippet(text: string, maxLength: number): string {
  if (maxLength <= 0 || text.length <= maxLength) return text
  return text.slice(0, maxLength) + SEARCH_SNIPPET_TRUNCATION_SUFFIX
}

/** Convert fetched HTML into plain text / lightweight markdown for LLM consumption. */
export function htmlToPlainText(html: string): string {
  return HtmlToMarkdownConverter.convert(html).trim()
}

/** Truncate or RAG-compress plain text before sending to the model. */
export async function limitWebPlainText(
  plainText: string,
  options: {
    query?: string
    limit?: number
    embeddingService?: ToolEmbeddingService
    ragEnabled?: boolean
  }
): Promise<string> {
  const limit = options.limit ?? DEFAULT_WEB_SEARCH_LIMITS.plainSnippetLength
  if (plainText.length <= limit) return plainText

  if (options.ragEnabled !== false && options.query && options.embeddingService?.isConfigured) {
    return SearchRagService.extractRelevantChunks(
      options.embeddingService,
      plainText,
      options.query,
      limit
    )
  }

  return plainText.substring(0, limit) + TRUNCATION_SUFFIX
}

export const EMPTY_WEB_PAGE_MESSAGE = 'The webpage is empty or cannot be parsed textually.'
export const UNAVAILABLE_WEB_PAGE_MESSAGE =
  'The webpage content is currently unavailable or inaccessible.'
