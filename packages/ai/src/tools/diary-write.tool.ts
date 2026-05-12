import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { writeFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const diaryWriteParams = z.object({
  date: z
    .string()
    .describe('The date for the new diary entry. Format: YYYY-MM-DD.'),
  content: z
    .string()
    .describe('The full markdown content for the new diary entry.'),
});

export class DiaryWriteTool extends AgentTool<typeof diaryWriteParams> {
  readonly name = 'diary_write';

  readonly description =
    'Create a new diary entry for a given date. ' +
    'If a diary entry already exists for that date, use diary_edit instead.';

  readonly parameters = diaryWriteParams;

  async execute(
    args: z.infer<typeof diaryWriteParams>,
    context: ToolContext,
  ): Promise<string> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.date)) {
      return `Error: Invalid date format "${args.date}". Expected YYYY-MM-DD.`;
    }

    const year = args.date.substring(0, 4);
    const month = args.date.substring(5, 7);
    const fileName = `${args.date}.md`;
    const filePath = join(context.vaultName, 'Journals', year, month, fileName);

    try {
      await access(filePath);
      return `Error: A diary entry for ${args.date} already exists. Use diary_edit to modify it.`;
    } catch {
      // 文件不存在，可以创建
    }

    try {
      const dirPath = join(context.vaultName, 'Journals', year, month);
      await mkdir(dirPath, { recursive: true });
      await writeFile(filePath, args.content, 'utf-8');

      console.log(`[DiaryWriteTool] ✅ 写入完成: ${filePath}`);

      if (context.vectorStore?.indexFile) {
        try {
          await context.vectorStore.indexFile(filePath);
        } catch (e) {
          console.warn('[Tool] Failed to index new diary', e);
        }
      }

      return `Successfully created diary entry for ${args.date}.`;
    } catch (e) {
      return `Error: Failed to create diary entry: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}
