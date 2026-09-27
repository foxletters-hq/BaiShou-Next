/** 只藏仍在排队、且已有用户消息 id 的那一条。已开流的消息必须留在对话里。 */
export function excludePendingQueuedUserMessages<T extends { id: string }>(
  messages: T[],
  pending: ReadonlyArray<{ userMessageId?: string | null }>
): T[] {
  const hideIds = new Set(
    pending
      .map((item) => item.userMessageId?.trim())
      .filter((id): id is string => Boolean(id))
  )
  if (hideIds.size === 0) return messages
  return messages.filter((message) => !hideIds.has(message.id))
}

/** 服务端快照回来后：已发出或已不在 pending 的占位丢掉，只留尚未落库的本地条。 */
export function reconcileOptimisticAfterServer<T extends { id: string; text?: string; userMessageId?: string }>(
  serverItems: T[],
  optimisticItems: T[]
): T[] {
  return optimisticItems.filter((item) => {
    const onServer = serverItems.some(
      (row) =>
        row.id === item.id ||
        (Boolean(item.userMessageId) && row.userMessageId === item.userMessageId) ||
        Boolean(item.text?.trim() && row.text?.trim() === item.text.trim())
    )
    if (onServer) return false
    // 还没落库的占位留在队尾；已经带上用户消息 id 的，等服务端列表接住后再去掉
    return item.id.startsWith('local-') && !item.userMessageId
  })
}

/** 服务端列表还没回来时，先把本地占位留在队尾；同文案 / 同用户消息不叠两条。 */
export function mergePendingQueueView<T extends { id: string; text?: string; userMessageId?: string }>(
  serverItems: T[],
  optimisticItems: T[]
): T[] {
  const serverIds = new Set(serverItems.map((item) => item.id))
  const serverUsers = new Set(
    serverItems
      .map((item) => item.userMessageId?.trim())
      .filter((id): id is string => Boolean(id))
  )
  const serverTexts = new Set(
    serverItems
      .map((item) => item.text?.trim())
      .filter((text): text is string => Boolean(text))
  )
  const extras = optimisticItems.filter((item) => {
    if (serverIds.has(item.id)) return false
    if (item.userMessageId && serverUsers.has(item.userMessageId)) return false
    if (item.text?.trim() && serverTexts.has(item.text.trim())) return false
    return true
  })
  return extras.length === 0 ? serverItems : [...serverItems, ...extras]
}

/** 排队条可能仍是本地占位 id，立即发送要换成 inbox 里的正式 id。 */
export function resolvePendingInputId(
  item: { id: string; text: string; userMessageId?: string },
  serverItems: ReadonlyArray<{ id: string; text: string; userMessageId?: string | null }>
): string | null {
  if (!item.id.startsWith('local-')) return item.id
  const byUser = item.userMessageId
    ? serverItems.find((row) => row.userMessageId === item.userMessageId)
    : undefined
  if (byUser) return byUser.id
  return serverItems.find((row) => row.text === item.text)?.id ?? null
}

export function formatPendingQueueCountLabel(count: number): string {
  const n = Math.max(0, Math.floor(count))
  return `${n} 条排队中`
}
