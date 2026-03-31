import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { SearchRagService } from './search/search-rag.service';

const urlReadParams = z.object({
  url: z
    .string()
    .url()
    .describe('The exact URL of the webpage or resource you want to read.'),
  query: z
    .string()
    .optional()
    .describe('Optional. If the targeted webpage is very long, provide a focus sentence/question here to extract the most relevant segments using vector RAG.'),
});

export class UrlReadTool extends AgentTool<typeof urlReadParams> {
  readonly name = 'url_read';

  readonly description =
    'Read the text content of a specific webpage URL directly. ' +
    'Use this when you have a specific link you want to analyze or summarize, instead of searching the whole web.';

  readonly parameters = urlReadParams;

  async execute(
    args: z.infer<typeof urlReadParams>,
    context: ToolContext,
  ): Promise<string> {
    try {
      // 外部环境劫持 (如 Electron 中绕开 CORS 等)
      if (context.webSearchResultFetcher) {
        return await context.webSearchResultFetcher(args.url);
      }

      // 如果没有挂载，自己简单拉一遍获取
      const response = await fetch(args.url);
      if (!response.ok) {
        return `Failed to fetch URL: HTTP status ${response.status} - ${response.statusText}`;
      }
      
      const htmlText = await response.text();
      
      // 简单剥离 HTML（保留主要的文本）
      // 去除 script 和 style 块
      let plainText = htmlText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '\n');
      plainText = plainText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '\n');
      
      // 替换所有其他的标签为你空格并整理
      plainText = plainText.replace(/<[^>]+>/g, ' ');
      plainText = plainText.replace(/\s+/g, ' ').trim();

      // 防止过大撑爆上下文。遇到超级巨怪进行临时 RAG 降频打击
      const LIMIT = 15000;
      if (plainText.length > LIMIT) {
         if (args.query && context.embeddingService?.isConfigured) {
            plainText = await SearchRagService.extractRelevantChunks(context.embeddingService, plainText, args.query, LIMIT);
         } else {
            plainText = plainText.substring(0, LIMIT) + '\n\n[Content truncated due to length limits...]';
         }
      }

      return plainText || 'The webpage is empty or cannot be parsed textually.';
    } catch (e) {
      return `Failed to read URL: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
