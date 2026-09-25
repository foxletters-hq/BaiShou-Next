/**
 * SessionListTool — 按本地日历日列出该时段有过发言的会话
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import {
  clampToolDateListFetchLimit,
  clampToolDateListLimit,
  formatCalendarDateRangeLabel,
  TOOL_DATE_LIST_DEFAULT_LIMIT,
  validateRequiredCalendarDateRange
} from './calendar-date-range.util'

const sessionListParams = z.object({
  start_date: z.string().describe('Start date (inclusive). Format: YYYY-MM-DD.'),
  end_date: z.string().describe('End date (inclusive). Format: YYYY-MM-DD.'),
  limit: z
    .number()
    .optional()
    .describe('Maximum number of sessions to return. Defaults to 20, max 50.')
})

export class SessionListTool extends AgentTool<typeof sessionListParams> {
  readonly name = 'session_list'

  readonly description =
    'List conversations that have original user/assistant messages in a local calendar date range. ' +
    'Required start_date/end_date (YYYY-MM-DD, inclusive). ' +
    'Returns session id, titles, first/last message time in the range, message counts, and a short preview. ' +
    'This lists pre-compression original text activity, not compaction summaries. ' +
    'Use this to discover whether the user talked in a period; ' +
    'then use message_search with session_id to read original snippets. ' +
    'When the current window (including any rolling compression summary) is insufficient, ' +
    'resolve relative dates with current_time first.'

  readonly parameters = sessionListParams

  async execute(args: z.infer<typeof sessionListParams>, context: ToolContext): Promise<string> {
    const dates = validateRequiredCalendarDateRange(args.start_date, args.end_date)
    if ('error' in dates) return dates.error

    const vaultId = String(context.vaultId ?? '').trim()
    if (!vaultId) {
      return 'Error: 缺少工作空间上下文，无法列出会话。'
    }

    const lister = context.messageSearcher?.listSessionsInDateRange
    if (!lister) {
      return '会话列表服务未配置。'
    }

    const limit = clampToolDateListLimit(args.limit ?? TOOL_DATE_LIST_DEFAULT_LIMIT)
    const fetchLimit = clampToolDateListFetchLimit(limit + 1)

    try {
      const rows = await lister.call(
        context.messageSearcher,
        vaultId,
        dates.startDate,
        dates.endDate,
        fetchLimit
      )
      const rangeLabel = formatCalendarDateRangeLabel(dates.startDate, dates.endDate)
      if (rows.length === 0) {
        return `${rangeLabel} 没有会话记录。`
      }

      const truncated = rows.length > limit
      const shown = truncated ? rows.slice(0, limit) : rows
      const lines: string[] = [`找到 ${shown.length} 个在 ${rangeLabel} 有发言的会话：\n`]

      for (let i = 0; i < shown.length; i++) {
        const row = shown[i]!
        const timeLabel =
          row.firstDate === row.lastDate
            ? row.firstDate
            : `${row.firstDate} ~ ${row.lastDate}`
        lines.push(
          `${i + 1}. 会话「${row.sessionTitle}」（id: ${row.sessionId}，${timeLabel}，${row.messageCount} 条）`
        )
        if (row.preview.trim()) {
          lines.push(`   ${row.preview}`)
        }
        lines.push('')
      }

      if (truncated) {
        lines.push(`仅显示最近 ${limit} 个会话，该时段可能还有更多。`)
      }

      return lines.join('\n')
    } catch (e) {
      return `列出会话失败：${e instanceof Error ? e.message : String(e)}`
    }
  }
}
