import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

const diaryListParams = z.object({
  start_date: z
    .string()
    .describe('Start date (inclusive). Format: YYYY-MM-DD.'),
  end_date: z
    .string()
    .describe('End date (inclusive). Format: YYYY-MM-DD.'),
});

export class DiaryListTool extends AgentTool<typeof diaryListParams> {
  readonly name = 'diary_list';

  readonly description =
    'List all diary entries within a date range (inclusive). ' +
    'Returns a list of dates that have diary entries, along with a brief preview of each entry. ' +
    'Use this to discover which days the user has written diaries.';

  readonly parameters = diaryListParams;

  async execute(
    _args: z.infer<typeof diaryListParams>,
    _context: ToolContext,
  ): Promise<string> {
    return 'Error: File-based diary listing is not available on mobile. Please use the database-based search instead.';
  }
}
