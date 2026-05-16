import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

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
    _args: z.infer<typeof diaryDeleteParams>,
    _context: ToolContext,
  ): Promise<string> {
    return 'Error: File-based diary deletion is not available on mobile. Please use the database-based tools instead.';
  }
}
