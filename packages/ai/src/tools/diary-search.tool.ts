/**
 * DiarySearchTool — 关键词搜索日记内容
 *
 * 优先使用 FTS5 全文索引（通过 ToolContext.diarySearcher）。
 * 若 FTS5 不可用，降级为文件遍历实现。
 *
 * 对标原版 `diary_search_tool.dart`
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const diarySearchParams = z.object({
  query: z
    .string()
    .describe(
      'The search keyword(s). Provide multiple synonyms separated by spaces to find ANY of these words.',
    ),
  start_date: z
    .string()
    .optional()
    .describe('Optional. Only search entries on or after this date (YYYY-MM-DD).'),
  end_date: z
    .string()
    .optional()
    .describe('Optional. Only search entries on or before this date (YYYY-MM-DD).'),
  limit: z
    .number()
    .optional()
    .describe('Maximum number of results to return. Defaults to 10.'),
});

export class DiarySearchTool extends AgentTool<typeof diarySearchParams> {
  readonly name = 'diary_search';

  readonly description =
    "Search the user's PERSONAL DIARY/JOURNAL entries by keyword. " +
    'Returns matching diary dates and content snippets. ' +
    "Use this when the user asks about their own past experiences, memories, or personal records.\n\n" +
    "IMPORTANT: This tool ONLY searches the user's personal diary entries stored locally, " +
    'NOT the internet. To search the internet, use the web_search tool instead.';

  readonly parameters = diarySearchParams;

  async execute(
    args: z.infer<typeof diarySearchParams>,
    context: ToolContext,
  ): Promise<string> {
    const keywords = args.query
      .trim()
      .split(/\s+/)
      .filter((k) => k.length > 0);
    if (keywords.length === 0) {
      return 'Error: Query contains no valid keywords.';
    }

    const limit = args.limit ?? 10;

    // 优先使用 FTS5 索引
    if (context.diarySearcher) {
      return this.executeFTS(args, context, keywords, limit);
    }

    // 降级为文件遍历
    return this.executeFileScan(args, context, keywords, limit);
  }

  private async executeFTS(
    args: z.infer<typeof diarySearchParams>,
    context: ToolContext,
    keywords: string[],
    limit: number,
  ): Promise<string> {
    const results: Array<{ date: string; snippet: string }> = [];

    for (const keyword of keywords) {
      const ftsResults = await context.diarySearcher!.searchFTS(keyword, limit * 2);

      for (const r of ftsResults) {
        // 日期范围过滤
        if (args.start_date && r.date < args.start_date) continue;
        if (args.end_date && r.date > args.end_date) continue;

        // 去重
        if (results.some(existing => existing.date === r.date)) continue;

        results.push({
          date: r.date,
          snippet: r.contentSnippet || '(no preview)',
        });

        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }

    if (results.length === 0) {
      return `No diary entries found matching "${args.query}".`;
    }

    results.sort((a, b) => b.date.localeCompare(a.date));

    const lines = [
      `Found ${results.length} diary entries matching "${args.query}" (FTS):\n`,
    ];
    for (const r of results) {
      lines.push(`## ${r.date}`);
      lines.push(r.snippet);
      lines.push('');
    }

    return lines.join('\n');
  }

  private async executeFileScan(
    args: z.infer<typeof diarySearchParams>,
    context: ToolContext,
    keywords: string[],
    limit: number,
  ): Promise<string> {
    const journalsDir = join(context.vaultName, 'Journals');
    const results: Array<{ date: string; snippet: string }> = [];

    try {
      const years = await readdir(journalsDir).catch(() => [] as string[]);

      for (const year of years) {
        if (!/^\d{4}$/.test(year)) continue;

        const months = await readdir(join(journalsDir, year)).catch(
          () => [] as string[],
        );

        for (const month of months) {
          const files = await readdir(join(journalsDir, year, month)).catch(
            () => [] as string[],
          );

          for (const file of files) {
            if (!file.endsWith('.md')) continue;
            const date = file.replace('.md', '');

            if (args.start_date && date < args.start_date) continue;
            if (args.end_date && date > args.end_date) continue;

            const content = await readFile(
              join(journalsDir, year, month, file),
              'utf-8',
            ).catch(() => '');

            const lowerContent = content.toLowerCase();
            const matched = keywords.some((k) =>
              lowerContent.includes(k.toLowerCase()),
            );

            if (matched && content.length > 0) {
              let snippet = '';
              for (const k of keywords) {
                const idx = lowerContent.indexOf(k.toLowerCase());
                if (idx !== -1) {
                  const start = Math.max(0, idx - 30);
                  const end = Math.min(content.length, idx + k.length + 30);
                  snippet =
                    (start > 0 ? '...' : '') +
                    content.slice(start, idx) +
                    '**' +
                    content.slice(idx, idx + k.length) +
                    '**' +
                    content.slice(idx + k.length, end) +
                    (end < content.length ? '...' : '');
                  break;
                }
              }

              if (!snippet) {
                snippet =
                  content.length > 100
                    ? content.slice(0, 100) + '...'
                    : content;
              }

              results.push({ date, snippet });
              if (results.length >= limit) break;
            }
          }
          if (results.length >= limit) break;
        }
        if (results.length >= limit) break;
      }
    } catch (e) {
      return `Error: Search failed: ${e instanceof Error ? e.message : String(e)}`;
    }

    if (results.length === 0) {
      return `No diary entries found matching "${args.query}".`;
    }

    results.sort((a, b) => b.date.localeCompare(a.date));

    const lines = [
      `Found ${results.length} diary entries matching "${args.query}":\n`,
    ];
    for (const r of results) {
      lines.push(`## ${r.date}`);
      lines.push(r.snippet);
      lines.push('');
    }

    return lines.join('\n');
  }
}
