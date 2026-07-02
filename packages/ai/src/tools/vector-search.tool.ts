/**
 * VectorSearchTool — 向量语义搜索工具
 *
 * 支持纯向量搜索和 FTS5+向量混合搜索两种模式。
 * 混合搜索使用 RRF (Reciprocal Rank Fusion) 算法融合排序。
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext, VectorSearchTimeFilter } from './agent.tool'
import { formatStoredTimestamp } from '@baishou/shared'
import { HybridSearchUtils } from '../rag/hybrid-search'
import type { ISearchResult } from '../rag/hybrid-search.types'
import {
  formatVectorSearchDateRangeLabel,
  resolveVectorSearchDateRange
} from './vector-search-date-filter.util'
import {
  VECTOR_SEARCH_DEFAULT_MIN_SCORE,
  VECTOR_SEARCH_DEFAULT_TOP_K,
  VECTOR_SEARCH_USER_CONFIG_THRESHOLD_KEY,
  VECTOR_SEARCH_USER_CONFIG_TOP_K_KEY
} from './vector-search.constants'

function resolveResultTimestamp(chunkText: string, createdAt?: number): string | undefined {
  const fromStored = formatStoredTimestamp(createdAt)
  if (fromStored) return fromStored

  const diaryMatch = chunkText.match(/\[(\d{4}-\d{2}-\d{2})\s/)
  if (diaryMatch?.[1]) {
    return `${diaryMatch[1]} (日记日期)`
  }

  return undefined
}

const vectorSearchParams = z.object({
  query: z.string().describe('要搜索的语义查询，描述你想找的内容的含义'),
  mode: z
    .enum(['vector', 'hybrid'])
    .optional()
    .describe('搜索模式: vector=纯语义搜索, hybrid=语义+关键词混合搜索（推荐）'),
  start_date: z
    .string()
    .optional()
    .describe('可选。仅搜索此日期及之后的内容（YYYY-MM-DD，本地日历日）。'),
  end_date: z
    .string()
    .optional()
    .describe('可选。仅搜索此日期及之前的内容（YYYY-MM-DD，本地日历日）。'),
  min_score: z
    .number()
    .optional()
    .describe('最低相似度阈值(0-1)，低于此分数的结果将被过滤。默认 0.4')
})

export class VectorSearchTool extends AgentTool<typeof vectorSearchParams> {
  readonly name = 'vector_search'

  readonly description =
    'Semantic search over conversation history and stored memories. ' +
    'You may use this when the user asks about past content, previous decisions, personal preferences, ' +
    'or earlier topics and the current context (including any rolling compression summary) is insufficient. ' +
    'REQUIRED when specific names, people, places, events, or dates are not clearly established in the ' +
    'current conversation: search before answering; do not guess or fabricate. ' +
    'Combine with diary_search when the answer may live in diary entries. ' +
    'Optionally set start_date and/or end_date (YYYY-MM-DD, local calendar day) to narrow results to a time window—' +
    'use this when the user mentions a specific period (e.g. last spring, March 2024, before a trip). ' +
    'Returns the most semantically relevant conversation snippets with scores.'

  readonly parameters = vectorSearchParams

  async execute(args: z.infer<typeof vectorSearchParams>, context: ToolContext): Promise<string> {
    if (args.query.trim().length === 0) {
      return '请提供搜索查询内容。'
    }

    const embeddingService = context.embeddingService
    const vectorStore = context.vectorStore

    if (!embeddingService || !vectorStore) {
      return '嵌入服务或向量数据库未配置，无法执行语义搜索。'
    }

    const dateRange = resolveVectorSearchDateRange(args.start_date, args.end_date)
    if ('error' in dateRange) {
      return dateRange.error
    }

    const timeFilter: VectorSearchTimeFilter | undefined =
      dateRange.startMs != null || dateRange.endMs != null
        ? { startMs: dateRange.startMs, endMs: dateRange.endMs }
        : undefined
    const rangeLabel = formatVectorSearchDateRangeLabel(args.start_date, args.end_date)

    const mode = args.mode ?? 'hybrid'
    const minScore =
      args.min_score ??
      (context.userConfig?.[VECTOR_SEARCH_USER_CONFIG_THRESHOLD_KEY] as number | undefined) ??
      VECTOR_SEARCH_DEFAULT_MIN_SCORE
    const maxResults =
      (context.userConfig?.[VECTOR_SEARCH_USER_CONFIG_TOP_K_KEY] as number | undefined) ??
      VECTOR_SEARCH_DEFAULT_TOP_K

    try {
      const queryEmbedding = await embeddingService.embedQuery(args.query)
      if (!queryEmbedding) {
        return '嵌入模型未配置或查询嵌入失败。请在设置中配置嵌入模型。'
      }

      const pipeline: string[] = []
      pipeline.push(`⚙️ 参数: topK=${maxResults}, 阈值=${minScore.toFixed(2)}, 模式=${mode}`)
      if (rangeLabel) {
        pipeline.push(`📅 时间范围: ${rangeLabel}`)
      }

      let results: ISearchResult[] = []

      const vectorRaw = await vectorStore.searchSimilar(queryEmbedding, maxResults, timeFilter)
      const vectorResults: ISearchResult[] = vectorRaw.map((r) => ({
        messageId: r.sourceId,
        sessionId: r.groupId,
        chunkText: r.chunkText,
        score: 1.0 - r.distance,
        source: 'vector' as const,
        createdAt: r.createdAt
      }))

      const bestVecScore = vectorResults.length > 0 ? vectorResults[0]!.score.toFixed(4) : '-'
      pipeline.push(`🔍 向量语义搜索: ${vectorResults.length} 条命中 (最佳 ${bestVecScore})`)

      if (mode === 'hybrid' && vectorStore.searchFts) {
        const ftsRaw = await vectorStore.searchFts(args.query, maxResults, timeFilter)
        pipeline.push(`📝 FTS关键词搜索: ${ftsRaw.length} 条命中`)

        const ftsResults: ISearchResult[] = ftsRaw.map((r) => ({
          messageId: r.messageId,
          sessionId: r.sessionId,
          chunkText: r.snippet,
          score: 0,
          source: 'fts' as const,
          createdAt: r.createdAt
        }))

        results = HybridSearchUtils.mergeRRF(ftsResults, vectorResults, maxResults)
        pipeline.push(`🔀 RRF融合排序: ${results.length} 条合并`)
      } else {
        results = vectorResults
      }

      const beforeScoreCount = results.length
      if (minScore > 0) {
        results = results.filter((r) => r.score >= minScore)
      }
      pipeline.push(
        `✂️ 相似度过滤 (≥${minScore.toFixed(2)}): ${beforeScoreCount} → ${results.length} 条`
      )

      if (results.length === 0) {
        const rangeHint = rangeLabel ? `（时间范围: ${rangeLabel}）` : ''
        return `${pipeline.join('\n')}\n没有找到语义相关的历史消息${rangeHint}（阈值=${minScore}）。`
      }

      const lines: string[] = []
      lines.push('═══ 搜索流水线 ═══')
      lines.push(...pipeline)
      lines.push('═══════════════')
      lines.push('')
      lines.push(`找到 ${results.length} 条相关记忆：\n`)

      for (let i = 0; i < results.length; i++) {
        const r = results[i]!
        const sourceLabel = r.source === 'hybrid' ? '混合' : r.source === 'fts' ? 'FTS' : '向量'
        lines.push(`--- 结果 ${i + 1} [${sourceLabel}] ---`)
        const timeLabel = resolveResultTimestamp(r.chunkText, r.createdAt)
        if (timeLabel) {
          lines.push(`时间: ${timeLabel}`)
        }
        lines.push(`内容: ${r.chunkText}`)
        lines.push(`相似度: ${r.score.toFixed(4)}`)
        lines.push('')
      }

      return lines.join('\n')
    } catch (e) {
      return `语义搜索失败: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}
