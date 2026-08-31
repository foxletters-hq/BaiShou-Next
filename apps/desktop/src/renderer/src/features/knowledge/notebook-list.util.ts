export function sortNotebooksForList<
  T extends { id: string; sortOrder?: number; createdAt?: number }
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const sa = a.sortOrder ?? 0
    const sb = b.sortOrder ?? 0
    if (sa !== sb) return sa - sb
    const ca = b.createdAt ?? 0
    const cb = a.createdAt ?? 0
    if (ca !== cb) return ca - cb
    return String(a.id).localeCompare(String(b.id))
  })
}

/** 空名称或未改动时不提交；否则返回去掉首尾空白后的新名称。 */
export function resolveNotebookRename(current: string, draft: string): string | null {
  const next = draft.trim()
  if (!next || next === current.trim()) return null
  return next
}

export function applyNotebookDragReorder<T extends { id: string }>(
  list: T[],
  activeId: string,
  overId: string
): T[] | null {
  if (activeId === overId) return null
  const from = list.findIndex((row) => row.id === activeId)
  const to = list.findIndex((row) => row.id === overId)
  if (from < 0 || to < 0 || from === to) return null
  return moveNotebookIndex(list, from, to)
}

/** 有封面图 URL 时带上更新时间，避免换图后仍显示缓存。 */
export function resolveNotebookCoverPreviewUrl(
  url: string | null | undefined,
  updatedAt?: number
): string | null {
  const trimmed = typeof url === 'string' ? url.trim() : ''
  if (!trimmed) return null
  if (!updatedAt || !Number.isFinite(updatedAt)) return trimmed
  return `${trimmed}${trimmed.includes('?') ? '&' : '?'}t=${updatedAt}`
}

export function moveNotebookIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list
  }
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (!item) return list
  next.splice(to, 0, item)
  return next
}
