import { shouldHidePersistedStreamingAssistant } from './persisted-streaming-assistant.util'

export type CompanionStreamUiLastMessage = {
  role?: string
  content?: string
  reasoning?: string
  parts?: ReadonlyArray<{ type?: string; data?: unknown }>
  toolInvocations?: unknown[]
  attachments?: unknown[]
}

export type CompanionStreamUiTimelineItem = {
  kind: string
  name?: string
  text?: string
}

/** 表情包要等正文结束才展示，不算「已经有可见回复」。 */
export function companionStreamHasVisibleBody(input: {
  text?: string
  reasoning?: string
  timeline?: ReadonlyArray<CompanionStreamUiTimelineItem>
  activeTool?: unknown
  completedToolsCount?: number
}): boolean {
  if (input.text?.trim()) return true
  if (input.reasoning?.trim()) return true
  if (input.activeTool) return true
  if ((input.completedToolsCount ?? 0) > 0) return true
  return (input.timeline ?? []).some((item) => {
    if (item.kind === 'tool') return item.name !== 'emoji_send'
    return Boolean(item.text?.trim())
  })
}

function lastAssistantHasPersistedContent(
  message: CompanionStreamUiLastMessage | null | undefined
): boolean {
  if (message?.role !== 'assistant') return false
  return Boolean(
    message.content?.trim() ||
    message.reasoning?.trim() ||
    (message.toolInvocations?.length ?? 0) > 0 ||
    (message.attachments?.length ?? 0) > 0
  )
}

/**
 * 空的等待点只能跟在「本轮用户消息 / 进行中助手」后面。
 * 上一轮已经说完时，残留 isStreaming 或仅有 pending 表情包不能再占一条生成中状态。
 */
export function resolveCompanionStreamUi(input: {
  isStreaming: boolean
  isBridgeActive: boolean
  isCompressing: boolean
  error?: string | null
  lastMessage?: CompanionStreamUiLastMessage | null
  text?: string
  reasoning?: string
  timeline?: ReadonlyArray<CompanionStreamUiTimelineItem>
  activeTool?: unknown
  completedToolsCount?: number
}): {
  hidePersistedLiveTurn: boolean
  showStreamingBubble: boolean
  composerBusy: boolean
} {
  const hidePersistedLiveTurn = shouldHidePersistedStreamingAssistant({
    isStreaming: input.isStreaming,
    isBridgeActive: input.isBridgeActive,
    lastMessage: input.lastMessage
  })
  const hasVisibleBody = companionStreamHasVisibleBody({
    text: input.text,
    reasoning: input.reasoning,
    timeline: input.timeline,
    activeTool: input.activeTool,
    completedToolsCount: input.completedToolsCount
  })
  const assistantPersistedDuringBridge =
    input.isBridgeActive && lastAssistantHasPersistedContent(input.lastMessage)
  const waitingForFirstToken =
    input.isStreaming &&
    !hasVisibleBody &&
    (input.lastMessage?.role === 'user' || hidePersistedLiveTurn)
  const liveSession = input.isStreaming || input.isBridgeActive || Boolean(input.error)
  const showStreamingBubble =
    liveSession &&
    (!assistantPersistedDuringBridge || hidePersistedLiveTurn) &&
    (!input.isCompressing || hasVisibleBody || Boolean(input.error)) &&
    (hasVisibleBody || Boolean(input.error) || waitingForFirstToken)
  const composerBusy =
    input.isCompressing ||
    (input.isStreaming &&
      (hasVisibleBody ||
        Boolean(input.error) ||
        input.lastMessage?.role === 'user' ||
        hidePersistedLiveTurn))

  return { hidePersistedLiveTurn, showStreamingBubble, composerBusy }
}
