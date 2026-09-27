/** 离开后仍保持挂载，便于日记 ↔ 伙伴快速切换 */
export const PERSISTENT_MAIN_PAGE_KEYS = new Set(['/diary', '/chat'])

/** 两侧都已挂载时的短遮罩，避免已画页面互相切时闪白 */
export const ROUTE_SWITCH_MASK_SECONDS = 0.12

export function nextMountedCacheKeys(
  prev: ReadonlySet<string>,
  activeKey: string | null
): Set<string> {
  const next = new Set<string>()
  for (const key of prev) {
    if (PERSISTENT_MAIN_PAGE_KEYS.has(key)) {
      next.add(key)
    }
  }
  if (activeKey) next.add(activeKey)
  return next
}

/**
 * 仅在上一页和下一页都已经挂着时盖短遮罩。
 * 首次进入日记、第一次进入尚未挂载的页面都不盖。
 */
export function shouldShowRouteSwitchMask(input: {
  previousKey: string | null
  nextKey: string | null
  mountedKeys: ReadonlySet<string>
}): boolean {
  const { previousKey, nextKey, mountedKeys } = input
  if (!previousKey || !nextKey || previousKey === nextKey) return false
  return mountedKeys.has(previousKey) && mountedKeys.has(nextKey)
}
