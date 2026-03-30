/**
 * DiaryDeleteTool — 删除指定日期的日记
 *
 * Agent 通过此工具删除指定日期的日记文件。
 * 安全机制：描述要求 Agent 先确认用户意图，并先用 diary_read 查看内容。
 *
 * 原始实现：lib/agent/tools/diary/diary_delete_tool.dart (117 行)
 */

import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { unlink, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const diaryDeleteParams = z.object({
  date: z
    .string()
    .describe('The date of the diary to delete, in YYYY-MM-DD format.'),
});

export class DiaryDeleteTool extends AgentTool<typeof diaryDeleteParams> {
  readonly name = 'diary_delete';

  readonly description =
    'Delete a diary entry for a specific date. ' +
    'This permanently removes the Markdown file at Journals/YYYY/MM/YYYY-MM-DD.md. ' +
    'IMPORTANT: Always confirm with the user before deleting. ' +
    'Use diary_read first to verify the content that will be deleted.';

  readonly parameters = diaryDeleteParams;

  async execute(
    args: z.infer<typeof diaryDeleteParams>,
    context: ToolContext,
  ): Promise<string> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.date)) {
      return `Error: Invalid date format "${args.date}". Expected YYYY-MM-DD.`;
    }

    const [year, month] = args.date.split('-') as [string, string];
    const filePath = join(context.vaultName, 'Journals', year, month, `${args.date}.md`);

    try {
      await access(filePath);
    } catch {
      return `No diary found for date ${args.date}. Nothing to delete.`;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const preview =
        content.length > 80 ? content.slice(0, 80) + '...' : content;

      await unlink(filePath);

      return (
        `Diary for ${args.date} has been deleted successfully.\n` +
        `Deleted content preview: ${preview}`
      );
    } catch (e) {
      return `Error: Failed to delete diary: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
