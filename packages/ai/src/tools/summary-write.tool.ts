/**
 * SummaryWriteTool — 将周期总结（周记、月报、季报、年度总结）写入磁盘 Summaries 目录并同步至数据库
 */

import { SummaryType, resolveSummaryPeriodBounds } from '@baishou/shared'
import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const summaryWriteParams = z.object({
  type: z
    .enum(['weekly', 'monthly', 'quarterly', 'yearly'])
    .describe('The summary period type: "weekly", "monthly", "quarterly", or "yearly".'),
  start_date: z
    .string()
    .describe(
      'Start date of the summary period in YYYY-MM-DD format: ' +
        'Monday of that week for weekly; first day of the month (YYYY-MM-01) for monthly; ' +
        'first day of the quarter (01-01, 04-01, 07-01, 10-01) for quarterly; ' +
        'first day of the year (YYYY-01-01) for yearly.'
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      'Optional end date of the summary period in YYYY-MM-DD format. ' +
        'If omitted, automatically computed from type and start_date.'
    ),
  content: z
    .string()
    .describe(
      'Complete Markdown body of the summary. Must be based on actual diaries or lower-level summaries read beforehand.'
    )
})

export class SummaryWriteTool extends AgentTool<typeof summaryWriteParams> {
  readonly name = 'summary_write'

  readonly description =
    'Write or update a period summary (weekly, monthly, quarterly, or yearly) in the vault Summaries directory and database. ' +
    'This is the shared persistence primitive for both new summaries and repairs: it only writes the provided content. ' +
    'Read the source material and any existing summary first. Use the summary-write skill to generate missing summaries, or the summary-repair skill to verify and repair an existing one.'

  readonly parameters = summaryWriteParams

  async execute(args: z.infer<typeof summaryWriteParams>, context: ToolContext): Promise<string> {
    const trimmedContent = args.content.trim()
    if (!trimmedContent) {
      return 'Error: Summary content cannot be empty.'
    }

    const rawLocale = context.userConfig?.['locale']
    const locale =
      typeof rawLocale === 'string' && rawLocale.trim() && rawLocale.trim() !== 'system'
        ? rawLocale.trim()
        : 'zh'
    const bounds = resolveSummaryPeriodBounds(
      args.type as SummaryType,
      args.start_date,
      args.end_date,
      locale
    )
    if (!bounds) {
      return `Error: Invalid start_date "${args.start_date}". Expected YYYY-MM-DD format.`
    }

    if (!context.summaryReader?.writeSummary && !context.rawDataSourceManager?.writeFile) {
      return 'Error: Summary writing is not available in the current context.'
    }

    try {
      if (context.summaryReader?.writeSummary) {
        const dbRes = await context.summaryReader.writeSummary({
          type: bounds.type,
          startDate: bounds.startDate,
          endDate: bounds.endDate,
          content: trimmedContent
        })
        if (!dbRes.ok) {
          return `Error: ${dbRes.message}`
        }
      }

      if (context.rawDataSourceManager?.writeFile) {
        await context.rawDataSourceManager.writeFile('summary', bounds.relativePath, trimmedContent)
      }

      return (
        `Successfully saved ${bounds.type} summary (${bounds.label}: ${bounds.startDateIso} ~ ${bounds.endDateIso}) ` +
        `to Summaries/${bounds.relativePath}.`
      )
    } catch (e) {
      return `Failed to write summary: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}
