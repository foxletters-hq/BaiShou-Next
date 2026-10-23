/** 回滚、重发、删除都要落到「这一轮的用户消息」。助手气泡向前找最近一条 user。 */
export function findPrecedingUserMessageId(
  messages: Array<{ id: string; role: string }>,
  messageId: string
): string | null {
  const index = messages.findIndex((item) => item.id === messageId)
  if (index < 0) return null
  if (messages[index]?.role === 'user') return messages[index].id
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (messages[cursor]?.role === 'user') return messages[cursor].id
  }
  return null
}
