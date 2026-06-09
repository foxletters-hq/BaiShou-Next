import type { CompactionMarkerData } from '@baishou/ai'

export type CompactionAnchor = {
  messageId: string
  record: CompactionMarkerData
}

export type MessageWithCompaction = {
  id: string
  role: string
  orderIndex?: number
  compactionRecord?: CompactionMarkerData | null
}

/** 对齐 desktop useChatMessages.resolveLatestCompactionAnchor */
export function resolveLatestCompactionAnchor(
  messages: readonly MessageWithCompaction[]
): CompactionAnchor | null {
  let best: CompactionAnchor | null = null
  let bestOrder = -1

  for (const msg of messages) {
    if (msg.role !== 'user' || !msg.compactionRecord) continue
    if (msg.compactionRecord.status === 'failed') continue
    const orderIndex = typeof msg.orderIndex === 'number' ? msg.orderIndex : bestOrder + 1
    if (orderIndex >= bestOrder) {
      bestOrder = orderIndex
      best = { messageId: msg.id, record: msg.compactionRecord }
    }
  }

  return best
}
