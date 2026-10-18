/**
 * MemoryDeleteTool — 按记忆唯一键删除
 *
 * 只接受 memory_store / vector_search 返回的 memory id（JSONL id = sourceId）。
 * 禁止按语义相似度批量删除。
 */

import { z } from 'zod'
import { formatLocalDate, MEMORY_SOURCE_TYPE, type ToolRawDataSourceManager } from '@baishou/shared'
import { AgentTool } from './agent.tool'
import type { ToolContext, VectorSourceLookup } from './agent.tool'

const memoryDeleteParams = z.object({
  memory_id: z
    .string()
    .optional()
    .describe(
      'Unique memory id from vector_search (memory_id) or memory_store (id). Never pass a description, date, or title.'
    ),
  memory_ids: z
    .array(z.string())
    .optional()
    .describe(
      'Optional extra unique memory ids to delete in the same call. Each must be an exact id.'
    )
})

export function collectMemoryDeleteIds(args: {
  memory_id?: string
  memory_ids?: string[]
}): string[] {
  const raw = [args.memory_id, ...(args.memory_ids ?? [])]
  const seen = new Set<string>()
  const ids: string[] = []
  for (const value of raw) {
    const id = typeof value === 'string' ? value.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function isLikelyNaturalLanguageQuery(id: string): boolean {
  if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(id)) return true
  if (/\s/.test(id)) return true
  if (/[，。？！,?!]/.test(id)) return true
  return false
}

function stripChunkSuffix(id: string): string {
  return id.replace(/_chunk_\d+$/, '')
}

function memoryShardMonth(createdAt?: number | null): string | undefined {
  if (createdAt == null || !Number.isFinite(createdAt)) return undefined
  return formatLocalDate(new Date(createdAt)).slice(0, 7)
}

function isMemoryNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /tombstone:\s*id not found/i.test(message)
}

function previewText(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60)}...` : text
}

async function tombstoneMemoryIfNeeded(
  rawManager: ToolRawDataSourceManager | undefined,
  sourceId: string,
  createdAt?: number | null
): Promise<'tombstoned' | 'absent'> {
  if (!rawManager) return 'absent'
  try {
    await rawManager.tombstone('memory', sourceId, {
      shardMonth: memoryShardMonth(createdAt)
    })
    return 'tombstoned'
  } catch (error) {
    if (isMemoryNotFoundError(error)) return 'absent'
    throw error
  }
}

export class MemoryDeleteTool extends AgentTool<typeof memoryDeleteParams> {
  readonly name = 'memory_delete'

  readonly description =
    'Delete stored long-term memories by unique memory_id only. ' +
    'Pass the exact id returned by vector_search (memory_id) or memory_store (id). ' +
    'Do not pass a description, date, title, or search query — this tool never searches and never deletes similar items. ' +
    'IMPORTANT: Always confirm with the user before deleting memories.'

  readonly parameters = memoryDeleteParams

  async execute(args: z.infer<typeof memoryDeleteParams>, context: ToolContext): Promise<string> {
    const ids = collectMemoryDeleteIds(args)
    if (ids.length === 0) {
      return '缺少记忆唯一键。请传入 vector_search 返回的 memory_id，或 memory_store 返回的 id。'
    }

    const naturalLanguageIds = ids.filter(isLikelyNaturalLanguageQuery)
    if (naturalLanguageIds.length > 0) {
      return (
        `⚠️ 错误：传入的参数 ${JSON.stringify(naturalLanguageIds.join(', '))} 疑似为自然语言描述，并非有效的记忆唯一 ID。\n` +
        'memory_delete 仅接受准确的记忆唯一键（如 mem_xxx）。\n' +
        '【正确工作流】请先调用 vector_search 检索相关内容获取其 memory_id，然后再传入 memory_delete 执行删除。\n' +
        '【系统强制要求】未执行删除前，严禁向用户声称或虚构已删除该记忆！'
      )
    }

    const vectorStore = context.vectorStore
    if (!vectorStore) {
      return '向量数据库未配置，无法操作记忆。'
    }

    const rawManager = context.rawDataSourceManager as ToolRawDataSourceManager | undefined

    try {
      const lines: string[] = []
      let deletedCount = 0

      for (const memoryId of ids) {
        const baseId = stripChunkSuffix(memoryId)
        const hit = await lookupMemory(vectorStore, memoryId, context.vaultId)
        const targetSourceId = hit?.sourceId || baseId

        let tombstoneResult = await tombstoneMemoryIfNeeded(
          rawManager,
          targetSourceId,
          hit?.createdAt
        )
        if (tombstoneResult === 'absent' && targetSourceId !== memoryId) {
          tombstoneResult = await tombstoneMemoryIfNeeded(rawManager, memoryId, hit?.createdAt)
        }

        if (tombstoneResult === 'absent' && !hit) {
          lines.push(`- 未找到记忆 id=${memoryId}，已跳过`)
          continue
        }

        const effectiveType = hit?.sourceType || MEMORY_SOURCE_TYPE
        await vectorStore.deleteBySource(effectiveType, targetSourceId)
        if (effectiveType === 'manual') {
          await vectorStore.deleteBySource(MEMORY_SOURCE_TYPE, targetSourceId)
        }
        if (memoryId !== targetSourceId) {
          await vectorStore.deleteBySource(effectiveType, memoryId)
          await vectorStore.deleteBySource(MEMORY_SOURCE_TYPE, memoryId)
        }

        deletedCount += 1
        const preview = hit?.chunkText ? previewText(hit.chunkText) : ''
        lines.push(
          preview ? `- 已删除 id=${targetSourceId}：${preview}` : `- 已删除 id=${targetSourceId}`
        )
      }

      if (deletedCount === 0) {
        return (
          `⚠️ 没有删除任何记忆（未找到对应条目）：\n${lines.join('\n')}\n` +
          '【系统强制要求】严禁向用户声称已删除成功！请如实告知用户未找到对应记忆，或者先使用 vector_search 重新检索确认真实的 memory_id。'
        )
      }

      return `已按唯一键删除 ${deletedCount} 条记忆：\n${lines.join('\n')}`
    } catch (e) {
      return `Failed to delete memories: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}

async function lookupMemory(
  vectorStore: NonNullable<ToolContext['vectorStore']>,
  memoryId: string,
  vaultId: string
): Promise<VectorSourceLookup | null> {
  if (!vectorStore.getBySource) return null
  const baseId = stripChunkSuffix(memoryId)

  let hit = await vectorStore.getBySource(MEMORY_SOURCE_TYPE, memoryId, vaultId)
  if (!hit) {
    hit = await vectorStore.getBySource('manual', memoryId, vaultId)
  }
  if (!hit && baseId !== memoryId) {
    hit = await vectorStore.getBySource(MEMORY_SOURCE_TYPE, baseId, vaultId)
    if (!hit) {
      hit = await vectorStore.getBySource('manual', baseId, vaultId)
    }
  }
  return hit
}
