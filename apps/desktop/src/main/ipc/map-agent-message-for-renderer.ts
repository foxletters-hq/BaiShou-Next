import {
  mapAttachmentsFromParts,
  normalizeFileCiteRefs,
  normalizePartData,
  normalizeSkillCiteRefs,
  sortAgentMessageParts,
  unwrapMessageMetadataForDisplay,
  type FileCiteRef,
  type SkillCiteRef
} from '@baishou/shared'
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
  skillRefs?: SkillCiteRef[]
  fileRefs?: FileCiteRef[]
}

function textFromPartData(data: unknown): string {
  const normalized = normalizePartData(data)
  const display =
    typeof normalized.displayText === 'string' && normalized.displayText.trim()
      ? normalized.displayText
      : null
  const raw =
    display ??
    (typeof normalized.text === 'string'
      ? normalized.text
      : typeof normalized.content === 'string'
        ? normalized.content
        : '')
  return unwrapMessageMetadataForDisplay(raw)
}

function skillRefsFromParts(parts: AgentPart[]): SkillCiteRef[] | undefined {
  for (const part of parts) {
    if (part.type !== 'text') continue
    const data = normalizePartData(part.data)
    const refs = normalizeSkillCiteRefs(
      data.skillRefs as Array<{ command?: string; content?: string }> | undefined
    )
    if (refs.length > 0) return refs
  }
  return undefined
}

function fileRefsFromParts(parts: AgentPart[]): FileCiteRef[] | undefined {
  for (const part of parts) {
    if (part.type !== 'text') continue
    const data = normalizePartData(part.data)
    const refs = normalizeFileCiteRefs(data.fileRefs as FileCiteRef[] | undefined)
    if (refs.length > 0) return refs
  }
  return undefined
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
  const orderedParts = sortAgentMessageParts(parts)
  const textParts = orderedParts.filter((p) => p.type === 'text')
  const reasoningParts = textParts.filter((p) => normalizePartData(p.data).isReasoning)
  const normalTextParts = textParts.filter((p) => !normalizePartData(p.data).isReasoning)

  const contentText = normalTextParts.map((p) => textFromPartData(p.data)).join('\n')
  const reasoningText = reasoningParts.map((p) => textFromPartData(p.data)).join('\n')
  const skillRefs = skillRefsFromParts(orderedParts)
  const fileRefs = fileRefsFromParts(orderedParts)

  const toolInvocations = orderedParts
    .filter((p) => p.type === 'tool')
    .map((p) => {
      const data = normalizePartData(p.data)
      return {
        state: data.status === 'completed' || data.status === 'failed' ? 'result' : 'call',
        toolCallId: String(data.callId ?? ''),
        toolName: String(data.name ?? data.toolName ?? ''),
        args: (data.arguments ?? data.input ?? {}) as Record<string, unknown>,
        result: data.result ?? data.output
      }
    })
    // 过滤掉 emoji_send 工具调用（表情包已作为图片附件显示，不需要在工具结果中重复展示）
    .filter((inv) => inv.toolName !== 'emoji_send')

  const attachments = mapAttachmentsFromParts(orderedParts)
  const compactionPart = orderedParts.find((p) => p.type === 'compaction')
  const compactionRecord = compactionPart ? parseCompactionMarkerData(compactionPart.data) : null

  return {
    ...msg,
    content: contentText,
    reasoning: reasoningText || undefined,
    toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
    attachments,
    hasCompactionMarker: compactionRecord != null,
    compactionRecord,
    ...(skillRefs ? { skillRefs } : {}),
    ...(fileRefs ? { fileRefs } : {}),
    ...(includeParts ? { parts: orderedParts } : {})
  }
}
