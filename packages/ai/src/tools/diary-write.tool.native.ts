import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

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
    _args: z.infer<typeof diaryWriteParams>,
    _context: ToolContext,
  ): Promise<string> {
    return 'Error: File-based diary writing is not available on mobile. Please use the database-based tools instead.';
  }
}
