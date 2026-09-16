/** 刷新结果末尾已是可展示的助手消息时，才能拆掉流式桥接 */
export function hasPersistedAssistantTail(
  messages: ReadonlyArray<{
    role?: string
    content?: string
    reasoning?: string
    parts?: unknown[]
  }>
): boolean {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant') return false
  return Boolean(
    last.content?.trim() || last.reasoning?.trim() || (last.parts?.length ?? 0) > 0
  )
}
