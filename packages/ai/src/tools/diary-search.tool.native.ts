import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

const diarySearchParams = z.object({
  query: z
    .string()
    .describe(
      'The search keyword(s). Provide multiple synonyms separated by spaces to find ANY of these words.',
    ),
  start_date: z
    .string()
    .optional()
    .describe('Optional. Only search entries on or after this date (YYYY-MM-DD).'),
  end_date: z
    .string()
    .optional()
    .describe('Optional. Only search entries on or before this date (YYYY-MM-DD).'),
  limit: z
    .number()
    .optional()
    .describe('Maximum number of results to return. Defaults to 10.'),
});

export class DiarySearchTool extends AgentTool<typeof diarySearchParams> {
  readonly name = 'diary_search';

  readonly description =
    "Search the user's PERSONAL DIARY/JOURNAL entries by keyword. " +
    'Returns matching diary dates and content snippets. ' +
    "Use this when the user asks about their own past experiences, memories, or personal records.\n\n" +
    "IMPORTANT: This tool ONLY searches the user's personal diary entries stored locally, " +
    'NOT the internet. To search the internet, use the web_search tool instead.';

  readonly parameters = diarySearchParams;

  async execute(
    _args: z.infer<typeof diarySearchParams>,
    _context: ToolContext,
  ): Promise<string> {
    return 'Error: File-based diary search is not available on mobile. Please use the database-based search instead.';
  }
}
