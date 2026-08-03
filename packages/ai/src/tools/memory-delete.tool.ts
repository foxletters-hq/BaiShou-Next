/**
 * MemoryDeleteTool — 删除向量记忆
 *
 * 通过语义搜索找到匹配的记忆条目，然后删除对应的嵌入数据。
 * sourceType=memory 时同步 tombstone JSONL；chat 等非 JSONL 管辖类型只删向量。
 *
 * 原始实现：lib/agent/tools/memory/memory_delete_tool.dart (143 行)
 */

import { z } from 'zod'
import { formatLocalDate, MEMORY_SOURCE_TYPE, type ToolRawDataSourceManager } from '@baishou/shared'
import { AgentTool } from './agent.tool'
import type { ToolContext, VectorSearchResult } from './agent.tool'

const memoryDeleteParams = z.object({
  query: z
    .string()
    .describe(
      'Search query to find memories to delete. Describe the content of memories you want to remove.'
    ),
  message_id: z
    .string()
    .optional()
    .describe(
      'Optional. Delete a specific memory by its message ID. If provided, query is ignored.'
    )
})

function memoryShardMonth(createdAt?: number): string | undefined {
  if (createdAt == null || !Number.isFinite(createdAt)) return undefined
  return formatLocalDate(new Date(createdAt)).slice(0, 7)
}

async function tombstoneMemoryIfNeeded(
  rawManager: ToolRawDataSourceManager | undefined,
  sourceId: string,
  createdAt?: number
): Promise<void> {
  if (!rawManager) return
  try {
    await rawManager.tombstone('memory', sourceId, {
      shardMonth: memoryShardMonth(createdAt)
    })
  } catch {
    // legacy ids may not exist in JSONL yet
  }
}

async function deleteHit(result: VectorSearchResult, context: ToolContext): Promise<void> {
  if (result.sourceType === MEMORY_SOURCE_TYPE) {
    await tombstoneMemoryIfNeeded(
      context.rawDataSourceManager as ToolRawDataSourceManager | undefined,
      result.sourceId,
      result.createdAt
    )
  }
  await context.vectorStore!.deleteBySource(result.sourceType, result.sourceId)
}

export class MemoryDeleteTool extends AgentTool<typeof memoryDeleteParams> {
  readonly name = 'memory_delete'

  readonly description =
    'Delete stored memories by semantic search. ' +
    'First searches for memories matching the query, then deletes the matching entries. ' +
    'Use this when the user wants to forget something or remove outdated information. ' +
    'IMPORTANT: Always confirm with the user before deleting memories.'

  readonly parameters = memoryDeleteParams

  async execute(args: z.infer<typeof memoryDeleteParams>, context: ToolContext): Promise<string> {
    const vectorStore = context.vectorStore
    if (!vectorStore) {
      return '向量数据库未配置，无法操作记忆。'
    }

    try {
      // 精确删除模式：message_id 面向 chat 消息嵌入，不在 Memory JSONL 管辖内
      if (args.message_id && args.message_id.length > 0) {
        await vectorStore.deleteBySource('chat', args.message_id)
        return `Memory chunks for message ID "${args.message_id}" have been deleted.`
      }

      if (args.query.trim().length === 0) {
        return 'Error: Missing required parameter: query or message_id'
      }

      // 语义搜索匹配的记忆
      const embeddingService = context.embeddingService
      if (!embeddingService) {
        return '嵌入服务未配置，无法搜索记忆。'
      }

      const queryEmbedding = await embeddingService.embedQuery(args.query)
      if (!queryEmbedding) {
        return '嵌入模型未配置或查询嵌入失败。'
      }

      const searchResults = await vectorStore.searchSimilar(queryEmbedding, 5)

      // 只删除高相关度的（similarity >= 0.5）
      const toDelete = searchResults.filter((r) => 1.0 - r.distance >= 0.5)

      if (toDelete.length === 0) {
        return `No memories found matching "${args.query}" with sufficient similarity (≥0.5). Nothing deleted.`
      }

      const previews: string[] = []
      const deletedSourceKeys = new Set<string>()
      for (const result of toDelete) {
        const key = `${result.sourceType}:${result.sourceId}`
        if (deletedSourceKeys.has(key)) continue
        deletedSourceKeys.add(key)
        await deleteHit(result, context)
        const preview =
          result.chunkText.length > 60 ? result.chunkText.slice(0, 60) + '...' : result.chunkText
        const score = (1.0 - result.distance).toFixed(2)
        previews.push(`- [${score}] ${preview}`)
      }

      return `Deleted ${previews.length} matching memory entries:\n${previews.join('\n')}`
    } catch (e) {
      return `Failed to delete memories: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}
