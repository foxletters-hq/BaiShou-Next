import { readAssistantStreamStatus } from '@baishou/shared'

type WorkspaceMessageLike = {
  id: string
  role?: string
  streamStatus?: string
  parts?: ReadonlyArray<{ type?: string; data?: unknown }>
}

function isInProgressAssistant(message: WorkspaceMessageLike | undefined): boolean {
  if (message?.role !== 'assistant') return false
  if (message.streamStatus === 'in_progress') return true
  return readAssistantStreamStatus(message.parts) === 'in_progress'
}

/**
 * 编辑重发或新一轮流式会再写一条助手消息。
 * 先前落盘、仍标着进行中的思考不能继续留在列表里，否则会叠一条「已中断」。
 * 正在流式时，列表末尾那条进行中记录交给实时气泡，避免两份思考过程。
 */
export function visibleWorkspaceMessages<T extends WorkspaceMessageLike>(
  messages: T[],
  options: { hideTailInProgress: boolean }
): T[] {
  const lastId = messages[messages.length - 1]?.id
  return messages.filter((message, index) => {
    if (!isInProgressAssistant(message)) return true
    const isTail = index === messages.length - 1
    if (!isTail) return false
    if (options.hideTailInProgress && message.id === lastId) return false
    return true
  })
}
