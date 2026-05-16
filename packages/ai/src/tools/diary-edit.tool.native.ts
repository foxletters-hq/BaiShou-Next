import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

const diaryEditParams = z.object({
  date: z
    .string()
    .describe('The exact date of the diary to edit. Format: YYYY-MM-DD.'),
  content: z
    .string()
    .describe('The markdown content for the diary.'),
  mode: z
    .enum(['append', 'overwrite'])
    .optional()
    .default('append')
    .describe('Edit mode. "append" adds content with a timestamp header (default). "overwrite" replaces the entire file.'),
  tags: z
    .string()
    .optional()
    .describe('Comma-separated tags to add/merge into the diary. Existing tags are preserved.'),
});

export class DiaryEditTool extends AgentTool<typeof diaryEditParams> {
  readonly name = 'diary_edit';

  readonly description =
    'Modify an existing diary entry. ' +
    'Default mode is "append", which adds new content with a timestamp header (##### HH:mm). ' +
    'Use "overwrite" mode to replace the entire content. ' +
    'Tags are automatically merged with existing ones.';

  readonly parameters = diaryEditParams;

  async execute(
    _args: z.infer<typeof diaryEditParams>,
    _context: ToolContext,
  ): Promise<string> {
    return 'Error: File-based diary editing is not available on mobile. Please use the database-based tools instead.';
  }
}
