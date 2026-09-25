/**
 * MessageSearchTool — 跨会话历史消息搜索
 *
 * 基于关键词搜索历史对话消息，实现跨会话记忆。
 * 无关键词但带日期时，按时间列出压缩前原文。
 *
 * 原始实现：lib/agent/tools/message/message_search_tool.dart (110 行)
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import {
  clampToolDateListFetchLimit,
  clampToolDateListLimit,
  formatCalendarDateRangeLabel,
  TOOL_DATE_LIST_DEFAULT_LIMIT,
  validateOptionalCalendarDateRange
} from './calendar-date-range.util'

const messageSearchParams = z.object({
  query: z
    .string()
    .optional()
    .describe(
      'Search keyword or phrase. Omit or leave empty to list original messages in a date range.'
    ),
  limit: z.number().optional().describe('Maximum number of results to return. Defaults to 10 for keyword search, 20 for date listing.'),
  start_date: z
    .string()
    .optional()
    .describe('Optional local calendar start date (YYYY-MM-DD) inclusive.'),
  end_date: z
    .string()
    .optional()
    .describe('Optional local calendar end date (YYYY-MM-DD) inclusive.'),
  session_id: z
    .string()
    .optional()
    .describe('Optional session id from session_list. Restricts search or date listing to one conversation.')
})

function formatMessageHits(
  results: Array<{ role: string; snippet: string; sessionTitle: string; date: string }>,
  heading: string
): string {
  const lines: string[] = [`${heading}\n`]
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!
    const role = r.role === 'user' ? '用户' : 'AI'
    lines.push(`${i + 1}. [${role}] 会话「${r.sessionTitle}」(${r.date})`)
    lines.push(`   ${r.snippet}`)
    lines.push('')
  }
  return lines.join('\n')
}

export class MessageSearchTool extends AgentTool<typeof messageSearchParams> {
  readonly name = 'message_search'

  readonly description =
    'Search or list the original pre-compression text of past conversation messages across sessions. ' +
    'With a keyword, this searches original user/assistant text, not compaction summaries. ' +
    'Without a keyword, both start_date and end_date are required to list original message snippets in that local calendar window. ' +
    'Optional start_date/end_date also narrow keyword results. ' +
    'Optional session_id from session_list restricts results to one conversation. ' +
    'Returns matching message snippets with session title and local timestamp. ' +
    'Useful after conversation compression, when the user asks what was discussed in a period, ' +
    'or when you need to recall previous conversations. ' +
    'Use session_list first if you only need a directory of conversations.'

  readonly parameters = messageSearchParams

  async execute(args: z.infer<typeof messageSearchParams>, context: ToolContext): Promise<string> {
    const query = (args.query ?? '').trim()
    const dates = validateOptionalCalendarDateRange(args.start_date, args.end_date)
    if ('error' in dates) return dates.error

    const hasBothDates = Boolean(dates.startDate && dates.endDate)
    if (!query && !hasBothDates) {
      return 'Error: 请提供搜索关键词，或同时提供 start_date 和 end_date 按时间列出消息。'
    }

    const sessionId = args.session_id?.trim() || undefined

    const vaultId = String(context.vaultId ?? '').trim()
    if (!vaultId) {
      return 'Error: 缺少工作空间上下文，无法搜索消息。'
    }

    const searcher = context.messageSearcher
    if (!searcher) {
      return '消息搜索服务未配置。'
    }

    try {
      if (!query) {
        const lister = searcher.listMessagesInDateRange
        if (!lister) {
          return '消息按时间列举服务未配置。'
        }
        const limit = clampToolDateListLimit(args.limit ?? TOOL_DATE_LIST_DEFAULT_LIMIT)
        const fetchLimit = clampToolDateListFetchLimit(limit + 1)
        const results = await lister.call(searcher, vaultId, fetchLimit, {
          startDate: dates.startDate,
          endDate: dates.endDate,
          ...(sessionId ? { sessionId } : {})
        })
        const rangeLabel = formatCalendarDateRangeLabel(dates.startDate, dates.endDate)
        if (results.length === 0) {
          return `${rangeLabel} 没有历史消息。`
        }
        const truncated = results.length > limit
        const shown = truncated ? results.slice(0, limit) : results
        const heading = `找到 ${shown.length} 条 ${rangeLabel} 的历史消息：`
        const body = formatMessageHits(shown, heading)
        return truncated ? `${body}仅显示最近 ${limit} 条，该时段可能还有更多。` : body
      }

      const limit = args.limit ?? 10
      const results = await searcher.searchMessages(query, limit, vaultId, {
        startDate: dates.startDate,
        endDate: dates.endDate,
        ...(sessionId ? { sessionId } : {})
      })

      if (results.length === 0) {
        return `未找到包含「${query}」的历史消息。`
      }

      return formatMessageHits(results, `找到 ${results.length} 条包含「${query}」的历史消息：`)
    } catch (e) {
      return `搜索失败：${e instanceof Error ? e.message : String(e)}`
    }
  }
}
