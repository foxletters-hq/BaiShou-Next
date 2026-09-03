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

function memoryShardMonth(createdAt?: number): string | undefined {
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
  createdAt?: number
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

    const vectorStore = context.vectorStore
    if (!vectorStore) {
      return '向量数据库未配置，无法操作记忆。'
    }

    const rawManager = context.rawDataSourceManager as ToolRawDataSourceManager | undefined

    try {
      const lines: string[] = []
      let deletedCount = 0

      for (const memoryId of ids) {
        const hit = await lookupMemory(vectorStore, memoryId, context.vaultId)
        const tombstoneResult = await tombstoneMemoryIfNeeded(rawManager, memoryId, hit?.createdAt)

        if (tombstoneResult === 'absent' && !hit) {
          lines.push(`- 未找到记忆 id=${memoryId}，已跳过`)
          continue
        }

        await vectorStore.deleteBySource(MEMORY_SOURCE_TYPE, memoryId)
        deletedCount += 1
        const preview = hit?.chunkText ? previewText(hit.chunkText) : ''
        lines.push(preview ? `- 已删除 id=${memoryId}：${preview}` : `- 已删除 id=${memoryId}`)
      }

      if (deletedCount === 0) {
        return `没有删除任何记忆。\n${lines.join('\n')}`
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
  return vectorStore.getBySource(MEMORY_SOURCE_TYPE, memoryId, vaultId)
}
