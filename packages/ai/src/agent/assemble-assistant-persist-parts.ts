import { ASSISTANT_STREAM_STATUS_IN_PROGRESS } from '@baishou/shared'
import { buildAssistantPartsFromTimeline } from './build-assistant-parts-from-timeline'
import { buildEmojiImagePartsFromToolCalls } from './agent-session-persist.utils'
import type { StreamAccumulator } from './stream-accumulator'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function assembleAssistantPersistParts(params: {
  accumulator: StreamAccumulator
  assistantMsgId: string
  sessionId: string
  userConfig?: Record<string, unknown>
  agentGateParts?: unknown[]
  fileChangeParts?: unknown[]
  includeInProgressMarker?: boolean
}): Array<{
  id: string
  messageId: string
  sessionId: string
  type: string
  data: Record<string, unknown>
}> {
  const { accumulator, assistantMsgId, sessionId } = params
  const emojiParts = buildEmojiImagePartsFromToolCalls(
    accumulator.toolCalls,
    assistantMsgId,
    sessionId,
    params.userConfig
  )
  const timelineParts = buildAssistantPartsFromTimeline({
    accumulator,
    assistantMsgId,
    sessionId,
    startSeq: emojiParts.length
  })
  const parts: Array<{
    id: string
    messageId: string
    sessionId: string
    type: string
    data: Record<string, unknown>
  }> = [...emojiParts, ...timelineParts]

  for (const gatePart of params.agentGateParts ?? []) {
    parts.push({
      id: generateUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'agent_gate',
      data: { ...(gatePart as Record<string, unknown>), seq: parts.length }
    })
  }

  for (const fileChange of params.fileChangeParts ?? []) {
    parts.push({
      id: generateUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'file_change',
      data: { ...(fileChange as Record<string, unknown>), seq: parts.length }
    })
  }

  if (params.includeInProgressMarker && parts.length > 0) {
    parts.push({
      id: generateUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'text',
      data: {
        text: '',
        streamStatus: ASSISTANT_STREAM_STATUS_IN_PROGRESS,
        seq: parts.length
      }
    })
  }

  return parts
}
