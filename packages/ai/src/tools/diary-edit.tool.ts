import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';
import { writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const diaryEditParams = z.object({
  date: z
    .string()
    .describe('The exact date of the diary to edit. Format: YYYY-MM-DD.'),
  content: z
    .string()
    .describe('The new FULL markdown content for the diary. This will completely overwrite the old content.'),
});

export class DiaryEditTool extends AgentTool<typeof diaryEditParams> {
  readonly name = 'diary_edit';

  readonly description =
    'Modify or rewrite an existing diary entry. ' +
    'You MUST provide the full new content, as it will overwrite the file. ' +
    'Usually, you should read the diary using diary_read first, process the modifications, and then write it back.';

  readonly parameters = diaryEditParams;

  async execute(
    args: z.infer<typeof diaryEditParams>,
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
      await writeFile(filePath, args.content, 'utf-8');
      
      // Update Hybrid Search / Vector Index integration
      if (context.vectorStore) {
         try {
           await context.vectorStore.deleteFile?.(filePath);
           await context.vectorStore.indexFile?.(filePath);
         } catch (e) {
           console.warn('[Tool] Failed to index on edit', e);
         }
      }

      return `Successfully modified the diary entry for ${args.date}.`;
    } catch {
      return `Error: Diary entry for ${args.date} does not exist. Use diary_write to create it instead.`;
    }
  }
}
