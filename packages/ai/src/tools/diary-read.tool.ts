import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const diaryReadParams = z.object({
  dates: z
    .array(z.string())
    .min(1)
    .max(20)
    .describe('One or more dates to read. Format: YYYY-MM-DD. Maximum 20 dates per request.'),
});

export class DiaryReadTool extends AgentTool<typeof diaryReadParams> {
  readonly name = 'diary_read';

  readonly description =
    'Read the full content of one or more diary entries by their exact dates. ' +
    'Supports reading up to 20 entries at once. ' +
    'Use diary_list or diary_search first if you do not know the exact date.';

  readonly parameters = diaryReadParams;

  async execute(
    args: z.infer<typeof diaryReadParams>,
    context: ToolContext,
  ): Promise<string> {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const results: string[] = [];

    for (const date of args.dates.slice(0, 20)) {
      if (!dateRegex.test(date)) {
        results.push(`## ${date}\nError: Invalid date format. Expected YYYY-MM-DD.\n`);
        continue;
      }

      const year = date.substring(0, 4);
      const month = date.substring(5, 7);
      const fileName = `${date}.md`;
      const filePath = join(context.vaultName, 'Journals', year, month, fileName);

      try {
        await access(filePath);
        const content = await readFile(filePath, 'utf-8');
        results.push(`## ${date}\n\n${content}\n`);
      } catch {
        results.push(`## ${date}\nNo diary entry found.\n`);
      }
    }

    return results.join('\n---\n\n');
  }
}
