import { mapAttachmentsFromParts } from '@baishou/shared'
import { parseCompactionMarkerData } from '@baishou/ai'
import type { AgentMessage, AgentPart } from '@baishou/shared'

export type RendererAgentMessage = AgentMessage & {
  content: string
  reasoning?: string
  toolInvocations?: Array<{
    state: string
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    result?: unknown
  }>
  attachments: ReturnType<typeof mapAttachmentsFromParts>
  hasCompactionMarker: boolean
  compactionRecord: ReturnType<typeof parseCompactionMarkerData>
  parts?: AgentPart[]
}

export function groupPartsByMessageId(parts: AgentPart[]): Map<string, AgentPart[]> {
  const grouped = new Map<string, AgentPart[]>()
  for (const part of parts) {
    const bucket = grouped.get(part.messageId)
    if (bucket) {
      bucket.push(part)
    } else {
      grouped.set(part.messageId, [part])
    }
  }
  return grouped
}

export function mapAgentMessageForRenderer(
  msg: AgentMessage,
  parts: AgentPart[],
  includeParts: boolean
): RendererAgentMessage {
  const textParts = parts.filter((p) => p.type === 'text')
  const reasoningParts = textParts.filter((p) => p.data?.isReasoning)
  const normalTextParts = textParts.filter((p) => !p.data?.isReasoning)

  const contentText = normalTextParts.map((p) => p.data?.text || p.data || '').join('\n')
  const reasoningText = reasoningParts.map((p) => p.data?.text || '').join('\n')

  const toolInvocations = parts
    .filter((p) => p.type === 'tool')
    .map((p) => ({
      state: p.data?.status === 'completed' || p.data?.status === 'failed' ? 'result' : 'call',
      toolCallId: p.data?.callId || '',
      toolName: p.data?.name || '',
      args: p.data?.arguments || {},
      result: p.data?.result
    }))

  const attachments = mapAttachmentsFromParts(parts)
  const compactionPart = parts.find((p) => p.type === 'compaction')
  const compactionRecord = compactionPart ? parseCompactionMarkerData(compactionPart.data) : null

  return {
    ...msg,
    content: contentText,
    reasoning: reasoningText || undefined,
    toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
    attachments,
    hasCompactionMarker: compactionRecord != null,
    compactionRecord,
    ...(includeParts ? { parts } : {})
  }
}
