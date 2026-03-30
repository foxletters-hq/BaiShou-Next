/**
 * DiaryListTool — 列出指定月份或日期范围内的日记
 *
 * Agent 通过此工具发现用户在某个时间段内写过哪些日记。
 * 返回日期列表和简短的首行预览。
 *
 * 原始实现：lib/agent/tools/diary/diary_list_tool.dart
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const diaryListParams = z.object({
  year: z.string().describe('The year to list diaries for, e.g. "2026"'),
  month: z
    .string()
    .describe('The month to list diaries for, e.g. "03" for March'),
});

export class DiaryListTool extends AgentTool<typeof diaryListParams> {
  readonly name = 'diary_list';

  readonly description =
    'List all diary entries for a given year and month. ' +
    'Returns a list of dates that have diary entries, along with a brief preview of each entry. ' +
    'Use this to discover which days the user has written diaries.';

  readonly parameters = diaryListParams;

  async execute(
    args: z.infer<typeof diaryListParams>,
    context: ToolContext,
  ): Promise<string> {
    const dirPath = join(context.vaultName, 'Journals', args.year, args.month);

    try {
      const files = await readdir(dirPath);
      const mdFiles = files
        .filter((f) => f.endsWith('.md'))
        .sort();

      if (mdFiles.length === 0) {
        return `No diary entries found for ${args.year}-${args.month}.`;
      }

      const lines: string[] = [
        `Found ${mdFiles.length} diary entries for ${args.year}-${args.month}:\n`,
      ];

      for (const file of mdFiles) {
        const date = file.replace('.md', '');
        try {
          const content = await readFile(join(dirPath, file), 'utf-8');
          // 取首行非空内容作为预览
          const firstLine = content
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.length > 0 && !l.startsWith('#'));
          const preview = firstLine
            ? firstLine.slice(0, 80) + (firstLine.length > 80 ? '...' : '')
            : '(empty)';
          lines.push(`- **${date}**: ${preview}`);
        } catch {
          lines.push(`- **${date}**: (unable to read)`);
        }
      }

      return lines.join('\n');
    } catch {
      return `No diary directory found for ${args.year}-${args.month}. The user may not have written any diaries this month.`;
    }
  }
}
