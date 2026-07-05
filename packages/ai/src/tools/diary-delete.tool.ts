import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import { runDiaryDeleteViaDb } from './diary-crud-db.util'

const diaryDeleteParams = z.object({
  date: z.string().describe('The exact date of the diary to delete. Format: YYYY-MM-DD.')
})

export class DiaryDeleteTool extends AgentTool<typeof diaryDeleteParams> {
  readonly name = 'diary_delete'

  readonly description =
    'Delete a specific diary entry. ' +
    'This is a destructive action and cannot be undone. Always double check before using.'

  readonly parameters = diaryDeleteParams

  async execute(args: z.infer<typeof diaryDeleteParams>, context: ToolContext): Promise<string> {
    return runDiaryDeleteViaDb(args, context)
  }
}
