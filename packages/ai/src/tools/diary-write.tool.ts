import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import { runDiaryWriteViaDb } from './diary-crud-db.util'

const diaryWriteParams = z.object({
  date: z.string().describe('The date for the new diary entry. Format: YYYY-MM-DD.'),
  content: z
    .string()
    .describe(
      'The complete markdown body to store. Write any desired time heading, section title, and #tags directly in this content; the system does not generate a time heading.'
    )
})

export class DiaryWriteTool extends AgentTool<typeof diaryWriteParams> {
  readonly name = 'diary_write'

  readonly description =
    'Create a new diary entry for a given date. ' +
    'Compose the complete diary body yourself, including any desired time heading or section title; the system does not add one. ' +
    'Write labels as #tags directly in content; do not write tags into file metadata. ' +
    'If a diary entry already exists for that date, use diary_edit instead.'

  readonly parameters = diaryWriteParams

  async execute(args: z.infer<typeof diaryWriteParams>, context: ToolContext): Promise<string> {
    return runDiaryWriteViaDb(args, context)
  }
}
