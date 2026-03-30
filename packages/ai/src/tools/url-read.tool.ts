/**
 * UrlReadTool — AI 可调用的网页读取工具
 *
 * 获取指定 URL 的网页内容，提取正文并返回给 AI。
 * 通常与 WebSearchTool 配合使用：
 * 1. AI 先搜索获取 URL 列表
 * 2. AI 选择感兴趣的 URL 调用此工具深入阅读
 *
 * 原始实现：lib/agent/tools/search/url_read_tool.dart (192 行)
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

/** 默认最大字符长度，避免 context 爆炸 */
const DEFAULT_MAX_LENGTH = 8000;

const urlReadParams = z.object({
  url: z
    .string()
    .describe(
      'The full URL to read (must start with http:// or https://).',
    ),
});

export class UrlReadTool extends AgentTool<typeof urlReadParams> {
  readonly name = 'url_read';

  readonly description =
    'Read and extract content from a web page URL. Converts HTML to clean ' +
    'text format. Use after web_search to read specific pages in detail. ' +
    'Returns the main text content of the page.';

  readonly parameters = urlReadParams;

  async execute(
    args: z.infer<typeof urlReadParams>,
    context: ToolContext,
  ): Promise<string> {
    const url = args.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'Error: Invalid URL format. Must start with http:// or https://';
    }

    const maxLength =
      (context.userConfig?.['max_length'] as number | undefined) ??
      DEFAULT_MAX_LENGTH;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return `Error: Failed to fetch URL: HTTP ${response.status}`;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('html') && !contentType.includes('text')) {
        return (
          `Non-HTML content (${contentType.split(';')[0]}). ` +
          'Cannot extract readable content from this URL.'
        );
      }

      const html = await response.text();

      // 提取标题
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const pageTitle = titleMatch
        ? stripHtmlTags(titleMatch[1] ?? '').trim()
        : new URL(url).hostname;

      // 提取主体内容：优先 <article>/<main>，否则 <body>
      let bodyHtml = html;
      const articleMatch = html.match(
        /<(article|main)[^>]*>([\s\S]*?)<\/\1>/i,
      );
      if (articleMatch) {
        bodyHtml = articleMatch[2] ?? html;
      } else {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          bodyHtml = bodyMatch[1] ?? html;
        }
      }

      // HTML → 清理文本（简化版 html-to-markdown）
      let text = stripHtmlTags(bodyHtml);

      // 截断过长内容
      const truncated = text.length > maxLength;
      if (truncated) {
        text = text.slice(0, maxLength);
        const lastParagraph = text.lastIndexOf('\n\n');
        if (lastParagraph > maxLength * 0.7) {
          text = text.slice(0, lastParagraph);
        }
        text += `\n\n[... Content truncated at ${maxLength} characters]`;
      }

      return `# ${pageTitle}\n**Source:** ${url}\n\n${text}`;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        return 'Error: Request timed out after 20 seconds.';
      }
      return `Error: Failed to read URL: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}

/** 简单 HTML 标签剥离 */
function stripHtmlTags(html: string): string {
  return html
    // 移除 script/style 块
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    // 块元素换行
    .replace(/<\/?(h[1-6]|p|div|br|li|tr)[^>]*>/gi, '\n')
    .replace(/<\/?(ul|ol|table|thead|tbody)[^>]*>/gi, '\n')
    // 移除剩余标签
    .replace(/<[^>]+>/g, '')
    // 解码 HTML 实体
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // 清理多余空白
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
