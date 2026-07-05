import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import { runDiaryWriteViaDb } from './diary-crud-db.util'

const diaryWriteParams = z.object({
  date: z.string().describe('The date for the new diary entry. Format: YYYY-MM-DD.'),
  content: z.string().describe('The full markdown content for the new diary entry.'),
  tags: z
    .string()
    .optional()
    .describe('Comma-separated tags for the diary entry, e.g. "生活,旅行".')
})

export class DiaryWriteTool extends AgentTool<typeof diaryWriteParams> {
  readonly name = 'diary_write'

  readonly description =
    'Create a new diary entry for a given date. ' +
    'Use the tags parameter for diary labels (comma-separated); do not put tags only in the markdown body. ' +
    'If a diary entry already exists for that date, use diary_edit instead.'

  readonly parameters = diaryWriteParams

  async execute(args: z.infer<typeof diaryWriteParams>, context: ToolContext): Promise<string> {
    return runDiaryWriteViaDb(args, context)
  }
}
