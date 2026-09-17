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
  embedQuery: (text: string) => Promise<number[] | null>
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
