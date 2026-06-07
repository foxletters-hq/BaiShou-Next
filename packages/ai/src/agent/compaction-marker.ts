import type { SessionRepository } from '@baishou/database'
import { normalizeCompressionOutput } from '@baishou/shared'

export interface CompactionMarkerData {
  snapshotId?: number
  compressedAt: number
  /** 摘要覆盖到的最后一条消息（技术锚点） */
  coveredUpToMessageId?: string
  /** 压缩摘要正文（发送给模型的内容） */
  streamTranscript?: string
  /** 压缩思考过程（仅展示，不注入模型上下文） */
  streamReasoning?: string
  phase?: 'auto' | 'manual'
  status?: 'completed' | 'failed'
  thoughtDurationMs?: number
  summaryDurationMs?: number
}

/** 落库前整理字段；思考与摘要已由 fullStream 原生分轨 */
export function finalizeCompressionForStorage(
  summaryText: string,
  reasoningText?: string
): { summaryText: string; reasoningText?: string } {
  const trimmedReasoning = reasoningText?.trim()
  return {
    summaryText,
    reasoningText: trimmedReasoning ? reasoningText : undefined
  }
}

export function parseCompactionMarkerData(data: unknown): CompactionMarkerData | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (typeof d.compressedAt !== 'number') return null

  let streamTranscript = typeof d.streamTranscript === 'string' ? d.streamTranscript : undefined
  let streamReasoning = typeof d.streamReasoning === 'string' ? d.streamReasoning : undefined

  if (streamTranscript) {
    const normalized = normalizeCompressionOutput(streamTranscript, streamReasoning ?? '')
    streamTranscript = normalized.summaryText || streamTranscript
    streamReasoning = normalized.reasoningText || streamReasoning
  }

  return {
    snapshotId: typeof d.snapshotId === 'number' ? d.snapshotId : undefined,
    compressedAt: d.compressedAt,
    coveredUpToMessageId:
      typeof d.coveredUpToMessageId === 'string' ? d.coveredUpToMessageId : undefined,
    streamTranscript,
    streamReasoning,
    phase: d.phase === 'manual' ? 'manual' : d.phase === 'auto' ? 'auto' : undefined,
    status: d.status === 'failed' ? 'failed' : d.status === 'completed' ? 'completed' : undefined,
    thoughtDurationMs: typeof d.thoughtDurationMs === 'number' ? d.thoughtDurationMs : undefined,
    summaryDurationMs: typeof d.summaryDurationMs === 'number' ? d.summaryDurationMs : undefined
  }
}

export async function writeCompactionMarker(
  sessionRepo: SessionRepository,
  sessionId: string,
  messageId: string,
  marker: CompactionMarkerData
): Promise<void> {
  await sessionRepo.upsertCompactionMarker(sessionId, messageId, marker)
}

export async function messageHasCompactionMarker(
  sessionRepo: SessionRepository,
  messageId: string
): Promise<boolean> {
  return sessionRepo.messageHasCompactionMarker(messageId)
}

/** 取会话中最后一条用户消息，用作压缩时间轴锚点 */
export function resolveLatestUserMessageId(
  messages: ReadonlyArray<{ id: string; role: string }>
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg?.role === 'user') return msg.id
  }
  return undefined
}

export function resolveCompactionReasoningForSnapshot(
  allMessages: Array<{ parts?: Array<{ type: string; data?: unknown }> }>,
  snapshotId: number | undefined
): string | undefined {
  if (snapshotId == null) return undefined

  for (let i = allMessages.length - 1; i >= 0; i--) {
    const part = allMessages[i]?.parts?.find((p) => p.type === 'compaction')
    if (!part?.data) continue
    const marker = parseCompactionMarkerData(part.data)
    if (marker?.snapshotId === snapshotId && marker.streamReasoning?.trim()) {
      return marker.streamReasoning.trim()
    }
  }
  return undefined
}

export function resolveCompactionDurationsForSnapshot(
  allMessages: Array<{ parts?: Array<{ type: string; data?: unknown }> }>,
  snapshotId: number | undefined
): { thoughtDurationMs?: number; summaryDurationMs?: number } {
  if (snapshotId == null) return {}

  for (let i = allMessages.length - 1; i >= 0; i--) {
    const part = allMessages[i]?.parts?.find((p) => p.type === 'compaction')
    if (!part?.data) continue
    const marker = parseCompactionMarkerData(part.data)
    if (marker?.snapshotId === snapshotId) {
      return {
        thoughtDurationMs: marker.thoughtDurationMs,
        summaryDurationMs: marker.summaryDurationMs
      }
    }
  }
  return {}
}
