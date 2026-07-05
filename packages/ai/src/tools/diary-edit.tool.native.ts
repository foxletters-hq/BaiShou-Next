import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import { runDiaryEditViaDb } from './diary-crud-db.util'

const diaryEditParams = z.object({
  date: z.string().describe('The exact date of the diary to edit. Format: YYYY-MM-DD.'),
  content: z
    .string()
    .describe(
      'Markdown content. In append mode (default): only the new section to add—existing paragraphs are kept automatically. ' +
        'In overwrite mode: the FULL entry body including ALL paragraphs to keep; never pass only the edited snippet or other paragraphs will be deleted.'
    ),
  mode: z
    .enum(['append', 'overwrite'])
    .optional()
    .default('append')
    .describe(
      'Edit mode. "append" adds content with a timestamp header (default, preferred). ' +
        '"overwrite" replaces the entire entry—use only when the user explicitly asked for a full rewrite.'
    ),
  tags: z
    .string()
    .optional()
    .describe('Comma-separated tags to add/merge into the diary. Existing tags are preserved.')
})

export class DiaryEditTool extends AgentTool<typeof diaryEditParams> {
  readonly name = 'diary_edit'

  readonly description =
    'Modify an existing diary entry. ' +
    'Call diary_read for the same date before editing to confirm existing content and structure. ' +
    'Never delete or drop paragraphs the user did not ask to change—keep all other sections intact. ' +
    'Default mode is "append", which adds new content with an automatically inserted timestamp header. ' +
    'Use "overwrite" only when necessary; content must then include the FULL diary with all preserved paragraphs, not just the edited part. ' +
    'Tags are automatically merged with existing ones.'

  readonly parameters = diaryEditParams

  async execute(args: z.infer<typeof diaryEditParams>, context: ToolContext): Promise<string> {
    return runDiaryEditViaDb(args, context)
  }
}
