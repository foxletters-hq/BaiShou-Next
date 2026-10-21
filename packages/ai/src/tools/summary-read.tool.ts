/**
 * SummaryReadTool — 读取 AI 生成的总结、列出已有总结，或复用位图检测机制查询缺失总结
 *
 * Agent 通过此工具：
 * 1) mode="read"（默认）：读取指定周期的周/月/季度/年度总结正文
 * 2) mode="list"：按周期类型、最近篇数（limit）或时间段（start_date ~ end_date）列出已生成的总结
 * 3) mode="missing"：复用系统位图与级联检测机制，查找可生成但尚未生成的周记、月报、季报、年度总结
 */

import { SummaryType, detectMissingSummaries, formatLocalDate, parseDateStr } from '@baishou/shared'
import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const summaryReadParams = z.object({
  type: z
    .enum(['weekly', 'monthly', 'quarterly', 'yearly', 'all'])
    .optional()
    .default('all')
    .describe(
      'Summary period type: "weekly", "monthly", "quarterly", "yearly", or "all" (when mode="missing" or mode="list").'
    ),
  start_date: z
    .string()
    .optional()
    .describe(
      'Start date of the summary period in YYYY-MM-DD format (required when mode="read"; optional lower bound when mode="list"): ' +
        'Monday of that week for weekly; first day of the month (YYYY-MM-01) for monthly; ' +
        'first day of the quarter for quarterly; first day of the year (YYYY-01-01) for yearly.'
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      'Optional end date filter (YYYY-MM-DD) when mode="list" to list existing summaries overlapping [start_date, end_date].'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'Optional maximum number of most recent existing summaries to return when mode="list" (default: 20).'
    ),
  mode: z
    .enum(['read', 'list', 'missing'])
    .optional()
    .default('read')
    .describe(
      'Operation mode: "read" (default) reads a specific summary by type and start_date; ' +
        '"list" lists existing generated summaries (optionally filtered by type, start_date, end_date, or recent limit); ' +
        '"missing" reuses the bitmap & cascade detector to list all completed periods that have source data but no summary yet.'
    )
})

const TYPE_TITLE: Record<SummaryType, string> = {
  [SummaryType.weekly]: 'Weekly (weekly)',
  [SummaryType.monthly]: 'Monthly (monthly)',
  [SummaryType.quarterly]: 'Quarterly (quarterly)',
  [SummaryType.yearly]: 'Yearly (yearly)'
}

function resolveToolLocale(context: ToolContext): string {
  const raw = context.userConfig?.['locale']
  if (typeof raw === 'string' && raw.trim() && raw.trim() !== 'system') {
    return raw.trim()
  }
  return 'zh'
}

async function executeDetectMissing(
  filterType: string | undefined,
  context: ToolContext
): Promise<string> {
  if (!context.summaryReader) {
    return 'Error: Summary reader is not available in the current context.'
  }
  if (!context.diarySearcher?.listInDateRange) {
    return 'Error: Diary index is not available to detect missing summaries.'
  }

  const diaryRows = await context.diarySearcher.listInDateRange('1970-01-01', '2099-12-31')
  const diaries = diaryRows
    .map((row) => ({ date: parseDateStr(row.date) }))
    .filter((item) => !Number.isNaN(item.date.getTime()))

  if (diaries.length === 0) {
    return 'No diary entries found in the current vault; no period summaries can be generated yet.'
  }

  const existingSummaries = (await context.summaryReader.listAllSummaries?.()) ?? []
  const monthlySummarySource =
    context.userConfig?.['monthlySummarySource'] === 'diaries' ? 'diaries' : 'weeklies'
  const locale = resolveToolLocale(context)
  const allMissing = detectMissingSummaries(
    diaries,
    existingSummaries,
    locale,
    monthlySummarySource
  )

  const filtered =
    filterType && filterType !== 'all'
      ? allMissing.filter((item) => item.type === filterType)
      : allMissing

  if (filtered.length === 0) {
    return filterType && filterType !== 'all'
      ? `No missing ${filterType} summaries detected (all eligible completed periods have been generated).`
      : 'No missing period summaries detected (all eligible completed weekly, monthly, quarterly, and yearly periods have been generated).'
  }

  const lines: string[] = [
    `Detected ${filtered.length} generatable missing summary period(s) (bitmap & cascade result):`,
    ''
  ]

  for (const type of [
    SummaryType.weekly,
    SummaryType.monthly,
    SummaryType.quarterly,
    SummaryType.yearly
  ]) {
    const group = filtered.filter((item) => item.type === type)
    if (group.length === 0) continue
    lines.push(`### ${TYPE_TITLE[type]} (${group.length})`)
    for (const item of group) {
      const startIso = formatLocalDate(item.startDate)
      const endIso = formatLocalDate(item.endDate)
      lines.push(
        `- **${item.label}** | type: \`${item.type}\` | start_date: \`${startIso}\` | end_date: \`${endIso}\``
      )
    }
    lines.push('')
  }

  lines.push(
    'Note: Monthly summaries depend on completed weekly summaries by default, quarterly depends on monthly, and yearly depends on quarterly. After saving lower-level summaries, call summary_read(mode: "missing") again to check if higher-level summaries were unlocked.'
  )

  return lines.join('\n')
}

async function executeListExisting(
  args: {
    type?: string
    start_date?: string
    end_date?: string
    limit?: number
  },
  context: ToolContext
): Promise<string> {
  if (!context.summaryReader) {
    return 'Error: Summary reader is not available in the current context.'
  }

  const limit = args.limit ?? 20
  const filterType = args.type && args.type !== 'all' ? args.type : undefined

  if (!context.summaryReader.listAllSummaries) {
    const targetType = filterType ?? SummaryType.weekly
    const available = await context.summaryReader.getAvailableSummaries(targetType, limit)
    if (available.length === 0) {
      return `No existing ${targetType} summaries found in the database.`
    }
    return `Available ${targetType} summaries:\n${available.join('\n')}`
  }

  const allSummaries = await context.summaryReader.listAllSummaries()
  const startBound = args.start_date?.trim() || undefined
  const endBound = args.end_date?.trim() || undefined

  const matched = allSummaries
    .map((item) => ({
      type: String(item.type),
      startDate: item.startDate,
      endDate: item.endDate,
      startIso: formatLocalDate(item.startDate),
      endIso: formatLocalDate(item.endDate)
    }))
    .filter((item) => {
      if (filterType && item.type !== filterType) return false
      if (startBound && item.endIso < startBound) return false
      if (endBound && item.startIso > endBound) return false
      return true
    })
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    .slice(0, limit)

  if (matched.length === 0) {
    return 'No existing summaries found matching the filter.'
  }

  const lines: string[] = [
    `Found ${matched.length} existing summary period(s) (most recent first):`,
    ''
  ]
  for (const item of matched) {
    lines.push(
      `- type: \`${item.type}\` | start_date: \`${item.startIso}\` | end_date: \`${item.endIso}\``
    )
  }
  return lines.join('\n')
}

export class SummaryReadTool extends AgentTool<typeof summaryReadParams> {
  readonly name = 'summary_read'

  readonly description =
    'Read AI-generated summaries (weekly, monthly, quarterly, or yearly), list existing summaries, or detect missing summaries. ' +
    'In "read" mode (default), pass type and start_date to read a specific period summary. ' +
    'In "list" mode, list existing summaries (optionally filtered by type, start_date, end_date, or recent limit). ' +
    'In "missing" mode, reuses the bitmap & cascade detector to find all completed periods that can be generated.'

  readonly parameters = summaryReadParams

  async execute(args: z.infer<typeof summaryReadParams>, context: ToolContext): Promise<string> {
    if (!context.summaryReader) {
      return '系统错误: 总结报表读取器未挂载注入'
    }

    try {
      if (args.mode === 'list') {
        return await executeListExisting(args, context)
      }

      if (args.mode === 'missing' || !args.start_date) {
        return await executeDetectMissing(args.type, context)
      }

      if (args.type === 'all') {
        return 'Error: Please specify a concrete summary type ("weekly", "monthly", "quarterly", or "yearly") when reading a summary by start_date.'
      }

      const resultObj = await context.summaryReader.readSummary(args.type, args.start_date)
      if (resultObj) {
        return resultObj.content
      }

      // 如果找不到，返回一个列表提示模型哪些是可以看的
      const availableDates = await context.summaryReader.getAvailableSummaries(args.type, 5)
      if (availableDates.length > 0) {
        return `No ${args.type} summary found for ${args.start_date}. Available ${args.type} summaries:\n${availableDates.join('\n')}`
      }

      return `No ${args.type} summaries found in the database.`
    } catch (e) {
      return `Failed to read summary: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}
