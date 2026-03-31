import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const diaryReadParams = z.object({
  date: z
    .string()
    .describe('The exact date of the diary to read. Format: YYYY-MM-DD.'),
});

export class DiaryReadTool extends AgentTool<typeof diaryReadParams> {
  readonly name = 'diary_read';

  readonly description =
    'Read the full content of a specific diary entry by its exact date. ' +
    'Use diary_list or diary_search first if you do not know the exact date.';

  readonly parameters = diaryReadParams;

  async execute(
    args: z.infer<typeof diaryReadParams>,
    context: ToolContext,
  ): Promise<string> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.date)) {
      return `Error: Invalid date format "${args.date}". Expected YYYY-MM-DD.`;
    }

    const year = args.date.substring(0, 4);
    const fileName = `${args.date}.md`;
    const filePath = join(context.vaultName, 'Entries', year, fileName);

    try {
      await access(filePath);
      const content = await readFile(filePath, 'utf-8');
      return `Diary entry for ${args.date}:\n\n${content}`;
    } catch {
      return `No diary entry found for date ${args.date}.`;
    }
  }
}
