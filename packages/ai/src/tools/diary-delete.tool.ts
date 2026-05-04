import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { unlink, access } from 'node:fs/promises';
import { join } from 'node:path';

const diaryDeleteParams = z.object({
  date: z
    .string()
    .describe('The exact date of the diary to delete. Format: YYYY-MM-DD.'),
});

export class DiaryDeleteTool extends AgentTool<typeof diaryDeleteParams> {
  readonly name = 'diary_delete';

  readonly description =
    'Delete a specific diary entry. ' +
    'This is a destructive action and cannot be undone. Always double check before using.';

  readonly parameters = diaryDeleteParams;

  async execute(
    args: z.infer<typeof diaryDeleteParams>,
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
      await unlink(filePath);
      
      if (context.vectorStore) {
         try {
           await context.vectorStore.deleteFile?.(filePath);
         } catch (e) {
           console.warn('[Tool] Failed to unindex on delete', e);
         }
      }

      return `Successfully deleted the diary entry for ${args.date}.`;
    } catch {
      return `Error: Could not find diary entry for ${args.date} to delete.`;
    }
  }
}
