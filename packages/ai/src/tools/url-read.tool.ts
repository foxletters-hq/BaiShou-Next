import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import {
  EMPTY_WEB_PAGE_MESSAGE,
  htmlToPlainText,
  limitWebPlainText
} from './search/web-content.util'
import { resolveWebSearchLimits } from './search/web-search-config.util'

const urlReadParams = z.object({
  url: z.string().url().describe('The exact URL of the webpage or resource you want to read.'),
  query: z
    .string()
    .optional()
    .describe(
      'Optional. If the targeted webpage is very long, provide a focus sentence/question here to extract the most relevant segments using vector RAG.'
    )
})

export class UrlReadTool extends AgentTool<typeof urlReadParams> {
  readonly name = 'url_read'

  readonly description =
    'Read the text content of a specific webpage URL directly. ' +
    'Use this when you have a specific link you want to analyze or summarize, instead of searching the whole web.'

  readonly parameters = urlReadParams

  async execute(args: z.infer<typeof urlReadParams>, context: ToolContext): Promise<string> {
    try {
      let plainText = ''

      if (context.webSearchResultFetcher) {
        plainText = await context.webSearchResultFetcher(args.url)
      } else {
        const response = await fetch(args.url)
        if (!response.ok) {
          return `Failed to fetch URL: HTTP status ${response.status} - ${response.statusText}`
        }
        plainText = htmlToPlainText(await response.text())
      }

      if (!plainText || plainText === EMPTY_WEB_PAGE_MESSAGE) {
        return plainText || EMPTY_WEB_PAGE_MESSAGE
      }

      const limits = resolveWebSearchLimits(context.userConfig)
      const ragEnabled =
        (context.userConfig?.web_search_rag_enabled as boolean | undefined) !== false

      plainText = await limitWebPlainText(plainText, {
        query: args.query,
        limit: limits.plainSnippetLength,
        embeddingService: context.embeddingService,
        ragEnabled
      })

      return plainText || EMPTY_WEB_PAGE_MESSAGE
    } catch (e) {
      return 'The webpage content is currently unavailable or inaccessible.'
    }
  }
}
