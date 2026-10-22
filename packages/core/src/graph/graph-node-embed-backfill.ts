import { graphNodeCardText } from '@baishou/shared'

export const EMBED_API_UNAVAILABLE = 'EMBED_API_UNAVAILABLE'
const CONSECUTIVE_EMBED_FAILURE_LIMIT = 3

export function isEmbedApiUnavailableError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(EMBED_API_UNAVAILABLE)
}

export async function backfillUnembeddedGraphNodes(options: {
  vaultId: string
  listUnembeddedLiveNodes: (
    vaultId: string
  ) => Promise<Array<{ id: string; name: string; summary: string }>>
  updateNodeEmbedding: (
    id: string,
    vaultId: string,
    embedding: number[],
    modelId: string
  ) => Promise<void>
  updateNodeEmbeddingsBatch?: (
    vaultId: string,
    modelId: string,
    items: Array<{ id: string; embedding: number[] }>
  ) => Promise<void>
  embedQuery: (text: string) => Promise<number[] | null>
  embedBatch?: (texts: string[]) => Promise<Array<number[] | null>>
  concurrency?: number
  modelId: string
  onProgress?: (progress: { completed: number; total: number; updated: number }) => void
  onBeforeItem?: () => Promise<void>
}): Promise<{ updated: number; failed: number; total: number }> {
  const vaultId = options.vaultId.trim()
  const modelId = options.modelId.trim()
  if (!vaultId || !modelId) return { updated: 0, failed: 0, total: 0 }
  const nodes = await options.listUnembeddedLiveNodes(vaultId)
  const total = nodes.length
  let updated = 0
  let failed = 0
  let completed = 0
  let consecutiveApiFails = 0

  const concurrency = Math.max(1, options.concurrency ?? 1)
  const useFastBatch =
    concurrency > 1 ||
    typeof options.embedBatch === 'function' ||
    typeof options.updateNodeEmbeddingsBatch === 'function'

  if (!useFastBatch) {
    for (const node of nodes) {
      await options.onBeforeItem?.()
      const text = graphNodeCardText(node.name, node.summary)
      if (!text) {
        failed += 1
        completed += 1
        options.onProgress?.({ completed, total, updated })
        continue
      }
      const embedding = await options.embedQuery(text)
      if (!embedding?.length) {
        consecutiveApiFails += 1
        failed += 1
        completed += 1
        options.onProgress?.({ completed, total, updated })
        if (consecutiveApiFails >= CONSECUTIVE_EMBED_FAILURE_LIMIT) {
          throw new Error(
            `${EMBED_API_UNAVAILABLE}: 嵌入接口连续失败 ${consecutiveApiFails} 次，已停止补齐图谱节点`
          )
        }
        continue
      }
      consecutiveApiFails = 0
      await options.updateNodeEmbedding(node.id, vaultId, embedding, modelId)
      updated += 1
      completed += 1
      options.onProgress?.({ completed, total, updated })
    }
    return { updated, failed, total }
  }

  const MAX_COMPUTED_TEXT_CACHE = 256
  const computedByText = new Map<string, number[]>()
  const setCachedVector = (text: string, vec: number[]) => {
    if (computedByText.has(text)) {
      computedByText.delete(text)
    } else if (computedByText.size >= MAX_COMPUTED_TEXT_CACHE) {
      const oldestKey = computedByText.keys().next().value
      if (oldestKey !== undefined) {
        computedByText.delete(oldestKey)
      }
    }
    computedByText.set(text, vec)
  }
  const batchSize = options.embedBatch ? 24 : Math.min(20, Math.max(4, concurrency * 2))

  for (let start = 0; start < nodes.length; start += batchSize) {
    if (start > 0 && Math.floor(start / batchSize) % 5 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    await options.onBeforeItem?.()
    const slice = nodes.slice(start, start + batchSize)
    const missingTexts: string[] = []
    const missingTextSet = new Set<string>()
    const sliceTexts: string[] = []

    for (const node of slice) {
      const text = graphNodeCardText(node.name, node.summary)
      sliceTexts.push(text)
      if (text && !computedByText.has(text) && !missingTextSet.has(text)) {
        missingTextSet.add(text)
        missingTexts.push(text)
      }
    }

    if (missingTexts.length > 0) {
      if (options.embedBatch) {
        const vectors = await options.embedBatch(missingTexts)
        for (let i = 0; i < missingTexts.length; i++) {
          const vec = vectors[i]
          if (vec?.length) {
            setCachedVector(missingTexts[i]!, vec)
          }
        }
      } else {
        let cursor = 0
        const workerCount = Math.min(concurrency, missingTexts.length)
        await Promise.all(
          Array.from({ length: workerCount }, async () => {
            while (cursor < missingTexts.length) {
              await options.onBeforeItem?.()
              const idx = cursor++
              if (idx >= missingTexts.length) break
              const text = missingTexts[idx]!
              const vec = await options.embedQuery(text)
              if (vec?.length) {
                setCachedVector(text, vec)
              }
            }
          })
        )
      }
    }

    await options.onBeforeItem?.()
    const dbUpdates: Array<{ id: string; embedding: number[] }> = []

    for (let i = 0; i < slice.length; i++) {
      const node = slice[i]!
      const text = sliceTexts[i]!
      if (!text) {
        failed += 1
        completed += 1
        continue
      }
      const embedding = computedByText.get(text)
      if (!embedding?.length) {
        consecutiveApiFails += 1
        failed += 1
        completed += 1
        if (consecutiveApiFails >= CONSECUTIVE_EMBED_FAILURE_LIMIT) {
          if (dbUpdates.length > 0) {
            if (options.updateNodeEmbeddingsBatch) {
              await options.updateNodeEmbeddingsBatch(vaultId, modelId, dbUpdates)
            } else {
              for (const item of dbUpdates) {
                await options.updateNodeEmbedding(item.id, vaultId, item.embedding, modelId)
              }
            }
          }
          options.onProgress?.({ completed, total, updated })
          throw new Error(
            `${EMBED_API_UNAVAILABLE}: 嵌入接口连续失败 ${consecutiveApiFails} 次，已停止补齐图谱节点`
          )
        }
        continue
      }
      consecutiveApiFails = 0
      dbUpdates.push({ id: node.id, embedding })
      updated += 1
      completed += 1
    }

    if (dbUpdates.length > 0) {
      if (options.updateNodeEmbeddingsBatch) {
        await options.updateNodeEmbeddingsBatch(vaultId, modelId, dbUpdates)
      } else {
        for (const item of dbUpdates) {
          await options.updateNodeEmbedding(item.id, vaultId, item.embedding, modelId)
        }
      }
    }
    options.onProgress?.({ completed, total, updated })
  }

  return { updated, failed, total }
}
