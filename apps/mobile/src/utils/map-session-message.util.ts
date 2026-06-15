import { mapAttachmentsFromParts, resolveAttachmentAbsolutePath } from '@baishou/shared'
import type { AgentMessagePart } from '@baishou/store'
import { parseCompactionMarkerData, type CompactionMarkerData } from '@baishou/ai'
import { resolveMobileAttachmentFilePath } from './mobile-attachment-ui.util'

/** local://（桌面）或裸路径 → React Native Image 可用的 file:// */
function toMobileAttachmentFilePath(filePath?: string, storageRoot?: string): string {
  if (storageRoot) {
    return resolveMobileAttachmentFilePath(filePath, storageRoot)
  }
  if (!filePath) return ''
  if (
    filePath.startsWith('file://') ||
    filePath.startsWith('content://') ||
    filePath.startsWith('data:')
  ) {
    return filePath
  }
  const abs = resolveAttachmentAbsolutePath(filePath)
  if (!abs) return filePath
  return abs.startsWith('/') ? `file://${abs}` : `file:///${abs}`
}

function stripBinaryFromParts(
  parts: Array<{ type: string; id?: string; data?: Record<string, unknown> | string }>
) {
  return parts.map((part) => {
    const partType = String(part.type ?? '').toLowerCase()
    if (
      (partType !== 'attachment' && partType !== 'image') ||
      typeof part.data !== 'object' ||
      !part.data
    ) {
      return part
    }
    const att = part.data as Record<string, unknown>
    const { data: _bin, ...rest } = att
    return { ...part, data: rest }
  })
}

/** 将 DB 消息（含 parts）映射为 Agent UI 消息（对齐 desktop agent-message.ipc） */
export function mapSessionMessageFromDb(
  msg: {
    id: string
    role: string
    orderIndex?: number
    createdAt?: string | Date
    parts?: Array<{ type: string; id?: string; data?: Record<string, unknown> | string }>
    inputTokens?: number
    outputTokens?: number
    cacheReadInputTokens?: number
    cacheWriteInputTokens?: number
    costMicros?: number
  },
  options?: { storageRoot?: string }
) {
  const parts = msg.parts || []

  const textParts = parts.filter((p) => p.type === 'text')
  const reasoningParts = textParts.filter(
    (p) => typeof p.data === 'object' && p.data && (p.data as { isReasoning?: boolean }).isReasoning
  )
  const normalTextParts = textParts.filter(
    (p) =>
      !(typeof p.data === 'object' && p.data && (p.data as { isReasoning?: boolean }).isReasoning)
  )

  const textFromPart = (p: (typeof parts)[number]) => {
    if (typeof p.data === 'object' && p.data && 'text' in p.data) {
      return String((p.data as { text?: string }).text ?? '')
    }
    return typeof p.data === 'string' ? p.data : ''
  }

  const content = normalTextParts.map(textFromPart).join('\n')
  const reasoning = reasoningParts.map(textFromPart).join('\n') || undefined

  const toolInvocations = parts
    .filter((p) => p.type === 'tool')
    .map((p) => {
      const data = typeof p.data === 'object' && p.data ? (p.data as Record<string, unknown>) : {}
      return {
        state: data.status === 'completed' || data.status === 'failed' ? 'result' : 'call',
        toolCallId: String(data.callId ?? ''),
        toolName: String(data.name ?? ''),
        args: data.arguments ?? {},
        result: data.result
      }
    })

  const attachments = mapAttachmentsFromParts(parts)?.map((att) => ({
    ...att,
    filePath: toMobileAttachmentFilePath(att.filePath, options?.storageRoot)
  }))

  const compactionPart = parts.find((p) => p.type === 'compaction')
  const compactionRecord: CompactionMarkerData | null = compactionPart
    ? parseCompactionMarkerData(compactionPart.data)
    : null

  return {
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system',
    content,
    reasoning,
    timestamp: new Date(msg.createdAt ?? Date.now()),
    orderIndex: msg.orderIndex,
    toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
    attachments,
    inputTokens: msg.inputTokens,
    outputTokens: msg.outputTokens,
    cacheReadInputTokens: msg.cacheReadInputTokens,
    cacheWriteInputTokens: msg.cacheWriteInputTokens,
    costMicros: msg.costMicros,
    compactionRecord,
    parts: parts.length > 0 ? (stripBinaryFromParts(parts) as AgentMessagePart[]) : undefined
  }
}
