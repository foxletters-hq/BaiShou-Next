/**
 * DiaryListTool — 列出指定日期范围内的日记
 *
 * Agent 通过此工具发现用户在某个时间段内写过哪些日记。
 * 返回日期列表和简短的首行预览。
 *
 * 对标原版 `diary_list_tool.dart`：支持 start_date / end_date 任意日期范围。
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const diaryListParams = z.object({
  start_date: z
    .string()
    .describe('Start date (inclusive). Format: YYYY-MM-DD.'),
  end_date: z
    .string()
    .describe('End date (inclusive). Format: YYYY-MM-DD.'),
});

export class DiaryListTool extends AgentTool<typeof diaryListParams> {
  readonly name = 'diary_list';

  readonly description =
    'List all diary entries within a date range (inclusive). ' +
    'Returns a list of dates that have diary entries, along with a brief preview of each entry. ' +
    'Use this to discover which days the user has written diaries.';

  readonly parameters = diaryListParams;

  async execute(
    args: z.infer<typeof diaryListParams>,
    context: ToolContext,
  ): Promise<string> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.start_date) || !dateRegex.test(args.end_date)) {
      return 'Error: Invalid date format. Expected YYYY-MM-DD.';
    }

    const journalsDir = join(context.vaultName, 'Journals');
    const results: Array<{ date: string; preview: string }> = [];

    try {
      // Parse date range boundaries
      const startDate = args.start_date;
      const endDate = args.end_date;

      // Enumerate year directories
      const startYear = parseInt(startDate.substring(0, 4));
      const endYear = parseInt(endDate.substring(0, 4));

      for (let year = startYear; year <= endYear; year++) {
        const yearStr = String(year);
        const yearDir = join(journalsDir, yearStr);

        let months: string[];
        try {
          months = await readdir(yearDir);
        } catch {
          continue;
        }

        for (const month of months.sort()) {
          if (!/^\d{2}$/.test(month)) continue;

          // Quick check: is this month within range?
          const monthPrefix = `${yearStr}-${month}`;
          if (monthPrefix < startDate.substring(0, 7)) continue;
          if (monthPrefix > endDate.substring(0, 7)) continue;

          const monthDir = join(yearDir, month);
          let files: string[];
          try {
            files = await readdir(monthDir);
          } catch {
            continue;
          }

          for (const file of files.sort()) {
            if (!file.endsWith('.md')) continue;
            const date = file.replace('.md', '');

            // Date range filter
            if (date < startDate || date > endDate) continue;

            try {
              const content = await readFile(join(monthDir, file), 'utf-8');
              const firstLine = content
                .split('\n')
                .map((l) => l.trim())
                .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'));
              const preview = firstLine
                ? firstLine.slice(0, 80) + (firstLine.length > 80 ? '...' : '')
                : '(empty)';
              results.push({ date, preview });
            } catch {
              results.push({ date, preview: '(unable to read)' });
            }
          }
        }
      }
    } catch (e) {
      return `Error: Failed to list diaries: ${e instanceof Error ? e.message : String(e)}`;
    }

    if (results.length === 0) {
      return `No diary entries found between ${args.start_date} and ${args.end_date}.`;
    }

    // Sort by date descending
    results.sort((a, b) => b.date.localeCompare(a.date));

    const lines = [
      `Found ${results.length} diary entries between ${args.start_date} and ${args.end_date}:\n`,
    ];
    for (const r of results) {
      lines.push(`- **${r.date}**: ${r.preview}`);
    }

    return lines.join('\n');
  }
}
