import type { MessageWithParts } from './message.adapter'
import { extractMessageText } from './context-compression.utils'

export interface CompressionRoundOption {
  /** 从 1 开始的可压缩轮次编号 */
  roundIndex: number
  startMessageId: string
  endMessageId: string
  startOrderIndex: number
  endOrderIndex: number
  /** 该轮用户消息摘要 */
  preview: string
}

export function buildCompressibleRounds(
  allMessages: MessageWithParts[],
  compactionCutoffOrderIndex?: number
): CompressionRoundOption[] {
  const eligible =
    compactionCutoffOrderIndex != null
      ? allMessages.filter((m) => m.orderIndex <= compactionCutoffOrderIndex)
      : [...allMessages]

  if (eligible.length === 0) return []

  const rounds: CompressionRoundOption[] = []
  let bucket: MessageWithParts[] = []

  const flush = () => {
    if (bucket.length === 0) return
    const first = bucket[0]!
    const last = bucket[bucket.length - 1]!
    const userMsg = bucket.find((m) => m.role === 'user')
    const previewRaw = userMsg ? extractMessageText(userMsg) : extractMessageText(last)
    const preview =
      previewRaw.length > 80 ? `${previewRaw.slice(0, 80)}…` : previewRaw || `轮次 ${rounds.length + 1}`

    rounds.push({
      roundIndex: rounds.length + 1,
      startMessageId: first.id,
      endMessageId: last.id,
      startOrderIndex: first.orderIndex,
      endOrderIndex: last.orderIndex,
      preview
    })
    bucket = []
  }

  for (const msg of eligible) {
    if (msg.role === 'user' && bucket.some((m) => m.role === 'user')) {
      flush()
    }
    bucket.push(msg)
  }
  flush()

  return rounds
}

export function sliceMessagesForRoundRange(
  allMessages: MessageWithParts[],
  rounds: CompressionRoundOption[],
  fromRound: number,
  toRound: number
): MessageWithParts[] {
  if (rounds.length === 0) return []

  const from = Math.max(1, Math.min(fromRound, rounds.length))
  const to = Math.max(from, Math.min(toRound, rounds.length))

  const startOrder = rounds[from - 1]!.startOrderIndex
  const endOrder = rounds[to - 1]!.endOrderIndex

  return allMessages.filter((m) => m.orderIndex >= startOrder && m.orderIndex <= endOrder)
}
