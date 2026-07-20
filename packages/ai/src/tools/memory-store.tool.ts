/**
 * MemoryStoreTool — 存储重要信息为长期向量记忆
 *
 * 写序：Memory JSONL（RawDataSourceManager）→ embed（sourceType=memory, sourceId=uuid）
 */

import { z } from 'zod'
import {
  MEMORY_SOURCE_TYPE,
  type MemoryRawRecord,
  type ToolRawDataSourceManager
} from '@baishou/shared'
import { AgentTool } from './agent.tool'
import type { ToolContext, ToolConfigParam } from './agent.tool'

const memoryStoreParams = z.object({
  content: z
    .string()
    .describe(
      'The text content to store as memory. Include clear context, e.g. "User preference: prefers dark theme".'
    ),
  tags: z
    .string()
    .optional()
    .describe('Optional comma-separated tags to categorize the memory. e.g. "preference,UI design"')
})

function newMemoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export class MemoryStoreTool extends AgentTool<typeof memoryStoreParams> {
  readonly name = 'memory_store'

  readonly description =
    'Store important information as long-term memory for later semantic search retrieval. ' +
    'Use this tool when the user expresses preferences, makes decisions, ' +
    'or when you encounter information worth remembering. ' +
    'Stored memories are vectorized and can be retrieved via the vector_search tool.'

  readonly parameters = memoryStoreParams

  get category(): string {
    return 'memory'
  }
  get icon(): string {
    return 'save'
  }

  get configurableParams(): ToolConfigParam[] {
    return [
      {
        key: 'memory_dedup_threshold',
        label: 'Deduplication Strictness (0-1.0)',
        type: 'number',
        defaultValue: 0.9
      }
    ]
  }

  async execute(args: z.infer<typeof memoryStoreParams>, context: ToolContext): Promise<string> {
    if (args.content.trim().length === 0) {
      return '请提供要存储的记忆内容。'
    }

    const embeddingService = context.embeddingService
    if (!embeddingService || !embeddingService.isConfigured) {
      return '嵌入模型未配置，无法存储记忆。请在设置中配置嵌入模型。'
    }

    const rawManager = context.rawDataSourceManager as ToolRawDataSourceManager | undefined
    if (!rawManager) {
      return '原始数据源管理器未就绪，无法落盘记忆。请重启应用或检查 Vault。'
    }

    const fullContent = args.tags ? `${args.content}\n[标签: ${args.tags}]` : args.content
    const tags = args.tags
      ? args.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : []

    try {
      let contentToStore = fullContent

      if (context.deduplicationService) {
        const dedupResult = await context.deduplicationService.checkAndMerge({
          newMemoryContent: fullContent,
          sessionId: context.sessionId
        })

        switch (dedupResult.action) {
          case 'skipped':
            return `[MemoryDeduplication Intercept]: Content is too similar to an existing memory (similarity=${dedupResult.highestSimilarity?.toFixed(3) ?? 'N/A'}). Operation cancelled to prevent duplication!`
          case 'merged':
            contentToStore = dedupResult.mergedContent ?? fullContent
            for (const removedId of dedupResult.removedIds) {
              try {
                await rawManager.tombstone('memory', removedId, {})
              } catch {
                // legacy ids may not exist in JSONL yet
              }
              await context.vectorStore?.deleteBySource(MEMORY_SOURCE_TYPE, removedId)
              await context.vectorStore?.deleteBySource('chat', removedId)
            }
            break
          case 'stored':
          default:
            break
        }
      } else if (context.vectorStore) {
        const embArray = await embeddingService.embedQuery(fullContent)
        if (embArray) {
          const similarCount = await context.vectorStore.searchSimilar(embArray, 1)
          const threshold =
            (context.userConfig?.['memory_dedup_threshold'] as number | undefined) ?? 0.9
          const firstSimilar = similarCount[0]
          if (firstSimilar) {
            const theDiffDistance = firstSimilar.distance || 0
            const isDupe =
              theDiffDistance < 1 - threshold || (theDiffDistance > threshold && threshold > 0.5)
            if (isDupe) {
              return `[MemoryDeduplication Intercept]: Content is too similar to an existing memory (diff=${theDiffDistance.toFixed(3)}). Operation cancelled to prevent duplication!`
            }
          }
        }
      }

      const now = Date.now()
      const id = newMemoryId()
      const record: MemoryRawRecord = {
        id,
        schemaVersion: 1,
        vaultName: context.vaultName,
        content: contentToStore,
        tags,
        sourceSessionId: context.sessionId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }

      const written = await rawManager.writeRecord('memory', record)

      await embeddingService.embedText({
        text: contentToStore,
        sourceType: MEMORY_SOURCE_TYPE,
        sourceId: id,
        groupId: `memory:${context.vaultName}`
      })

      const memoryMgr = rawManager.getMemoryManager?.()
      if (memoryMgr) {
        await memoryMgr.commitIndexed(written.relativePath, written.contentHash)
      }

      const preview = args.content.length > 100 ? args.content.slice(0, 100) + '...' : args.content
      return (
        `记忆已成功存储并建立向量索引。\n内容: ${preview}` +
        (args.tags ? `\n标签: ${args.tags}` : '') +
        `\nid: ${id}`
      )
    } catch (e) {
      return `存储记忆失败: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}
