/**
 * MessageSearchTool — 跨会话历史消息搜索
 *
 * 基于关键词搜索历史对话消息，实现跨会话记忆。
 *
 * 原始实现：lib/agent/tools/message/message_search_tool.dart (110 行)
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const messageSearchParams = z.object({
  query: z.string().describe('The search keyword or phrase to find in past conversations.'),
  limit: z.number().optional().describe('Maximum number of results to return. Defaults to 10.'),
  start_date: z
    .string()
    .optional()
    .describe('Optional local calendar start date (YYYY-MM-DD) inclusive.'),
  end_date: z
    .string()
    .optional()
    .describe('Optional local calendar end date (YYYY-MM-DD) inclusive.')
})

export class MessageSearchTool extends AgentTool<typeof messageSearchParams> {
  readonly name = 'message_search'

  readonly description =
    'Search the original pre-compression text of past conversation messages across sessions by keyword. ' +
    'This searches original user/assistant text, not compaction summaries. ' +
    'Optional start_date/end_date limit results to local calendar days. ' +
    'Returns matching message snippets with session title and local timestamp. ' +
    'Useful when the user references something discussed before, ' +
    'or when you need to recall previous conversations.'

  readonly parameters = messageSearchParams

  async execute(args: z.infer<typeof messageSearchParams>, context: ToolContext): Promise<string> {
    if (args.query.trim().length === 0) {
      return 'Error: 请提供搜索关键词。'
    }

    const vaultId = String(context.vaultId ?? '').trim()
    if (!vaultId) {
      return 'Error: 缺少工作空间上下文，无法搜索消息。'
    }

    const searcher = context.messageSearcher
    if (!searcher) {
      return '消息搜索服务未配置。'
    }

    const limit = args.limit ?? 10

    try {
      const results = await searcher.searchMessages(args.query, limit, vaultId, {
        startDate: args.start_date,
        endDate: args.end_date
      })

      if (results.length === 0) {
        return `未找到包含「${args.query}」的历史消息。`
      }

      const lines: string[] = [`找到 ${results.length} 条包含「${args.query}」的历史消息：\n`]

      for (let i = 0; i < results.length; i++) {
        const r = results[i]!
        const role = r.role === 'user' ? '用户' : 'AI'
        lines.push(`${i + 1}. [${role}] 会话「${r.sessionTitle}」(${r.date})`)
        lines.push(`   ${r.snippet}`)
        lines.push('')
      }

      return lines.join('\n')
    } catch (e) {
      return `搜索失败：${e instanceof Error ? e.message : String(e)}`
    }
  }
}
