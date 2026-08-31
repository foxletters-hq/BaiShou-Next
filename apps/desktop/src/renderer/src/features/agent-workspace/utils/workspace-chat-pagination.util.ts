/** 工作台单次拉取的消息条数（含工具 / 思考 parts） */
export const WORKSPACE_MESSAGE_PAGE_SIZE = 60

export function workspaceHasMoreMessages(
  fetchedCount: number,
  requestedLimit: number = WORKSPACE_MESSAGE_PAGE_SIZE
): boolean {
  return fetchedCount >= requestedLimit
}

export function prependOlderWorkspaceMessages<T extends { id: string }>(
  current: readonly T[],
  olderPage: readonly T[]
): T[] {
  if (olderPage.length === 0) return [...current]
  const existingIds = new Set(current.map((item) => item.id))
  const uniqueOlder = olderPage.filter((item) => !existingIds.has(item.id))
  return [...uniqueOlder, ...current]
}
