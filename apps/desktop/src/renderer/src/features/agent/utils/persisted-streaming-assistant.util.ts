import { readAssistantStreamStatus } from '@baishou/shared'

export function isPersistedAssistantStreamInProgress(message: {
  role?: string
  parts?: ReadonlyArray<{ type?: string; data?: unknown }>
} | null | undefined): boolean {
  if (message?.role !== 'assistant') return false
  return readAssistantStreamStatus(message.parts) === 'in_progress'
}

/** 当前轮还在流式/桥接时，落库的进行中助手气泡交给 StreamingBubble，避免两份叠在一起。 */
export function shouldHidePersistedStreamingAssistant(input: {
  isStreaming: boolean
  isBridgeActive: boolean
  lastMessage?: {
    role?: string
    parts?: ReadonlyArray<{ type?: string; data?: unknown }>
  } | null
}): boolean {
  if (!input.isStreaming && !input.isBridgeActive) return false
  return isPersistedAssistantStreamInProgress(input.lastMessage)
}

/**
 * 流式错误只属于本轮。上一轮已经说完的助手气泡不能套用当前 stream.error，
 * 否则天气回复和正在搜网页的气泡会各挂一条「已中断本轮」。
 */
export function resolvePersistedAssistantStreamError(input: {
  messageRole: string
  messageId: string
  lastAssistantMessageId?: string
  lastMessageRole?: string
  streamError?: string | null
  liveBubbleVisible: boolean
}): string | undefined {
  if (!input.streamError) return undefined
  if (input.messageRole !== 'assistant') return undefined
  if (input.liveBubbleVisible) return undefined
  if (input.messageId !== input.lastAssistantMessageId) return undefined
  if (input.lastMessageRole !== 'assistant') return undefined
  return input.streamError
}
