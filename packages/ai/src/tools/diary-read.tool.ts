/**
 * DiaryReadTool — 读取指定日期的日记内容
 *
 * Agent 通过此工具读取用户的 Markdown 日记文件。
 * 支持批量读取（最多 20 个日期），返回完整的 Markdown 内容。
 *
 * 原始实现：lib/agent/tools/diary/diary_read_tool.dart
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const diaryReadParams = z.object({
  dates: z
    .array(z.string())
    .describe(
      'A list of dates to read diaries for, in YYYY-MM-DD format. Maximum 20 dates.',
    ),
});

export class DiaryReadTool extends AgentTool<typeof diaryReadParams> {
  readonly name = 'diary_read';

  readonly description =
    'Read multiple diary entries for specific dates. Returns the full Markdown content of the diary files. ' +
    'You can request up to 20 dates at once. Date format: YYYY-MM-DD (e.g. 2026-03-15).';

  readonly parameters = diaryReadParams;

  async execute(
    args: z.infer<typeof diaryReadParams>,
    context: ToolContext,
  ): Promise<string> {
    const dates = args.dates.slice(0, 20);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    const lines: string[] = [];
    let foundCount = 0;
    let missingCount = 0;

    for (const date of dates) {
      if (!dateRegex.test(date)) {
        lines.push(`⚠️ Invalid date format "${date}". Expected YYYY-MM-DD.\n`);
        missingCount++;
        continue;
      }

      const [year, month] = date.split('-') as [string, string];
      const filePath = join(context.vaultName, 'Journals', year, month, `${date}.md`);

      try {
        await access(filePath);
        const content = await readFile(filePath, 'utf-8');
        lines.push(`## [${date}]`);
        lines.push(content);
        lines.push('\n---\n');
        foundCount++;
      } catch {
        lines.push(`## [${date}]`);
        lines.push('*No diary found for this date.*\n');
        missingCount++;
      }
    }

    return lines.join('\n').trimEnd();
  }
}
