/** 按保存的 id 顺序重排；未出现在顺序里的条目追加在末尾 */
export function applyShortcutDisplayOrder<T extends { id: string }>(
  items: T[],
  orderIds: string[] | null | undefined
): T[] {
  if (!orderIds?.length) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const seen = new Set<string>()
  const ordered: T[] = []
  for (const id of orderIds) {
    const item = byId.get(id)
    if (!item || seen.has(id)) continue
    ordered.push(item)
    seen.add(id)
  }
  for (const item of items) {
    if (seen.has(item.id)) continue
    ordered.push(item)
    seen.add(item.id)
  }
  return ordered
}
