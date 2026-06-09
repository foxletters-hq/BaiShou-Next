import { mapAttachmentsFromParts } from '@baishou/shared'
import type { AgentMessagePart } from '@baishou/store'

/** 将 DB 消息（含 parts）映射为 Agent UI 消息（对齐 desktop agent-message.ipc） */
export function mapSessionMessageFromDb(msg: {
  id: string
  role: string
  createdAt?: string | Date
  parts?: Array<{ type: string; id?: string; data?: Record<string, unknown> | string }>
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
}) {
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

  const attachments = mapAttachmentsFromParts(parts)

  return {
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system',
    content,
    reasoning,
    timestamp: new Date(msg.createdAt ?? Date.now()),
    toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
    attachments,
    inputTokens: msg.inputTokens,
    outputTokens: msg.outputTokens,
    costMicros: msg.costMicros,
    parts: parts.length > 0 ? (parts as AgentMessagePart[]) : undefined
  }
}
