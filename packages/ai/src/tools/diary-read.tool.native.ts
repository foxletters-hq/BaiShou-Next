import { z } from 'zod';
import { AgentTool } from './agent.tool';
import type { ToolContext } from './agent.tool';

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
    _args: z.infer<typeof diaryReadParams>,
    _context: ToolContext,
  ): Promise<string> {
    return 'Error: File-based diary reading is not available on mobile. Please use the database-based search instead.';
  }
}
