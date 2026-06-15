import {
  ALL_SIDEBAR_NAV_IDS,
  SIDEBAR_NAV_PATHS,
  getDefaultHiddenNavIds,
  reorderSyncNavIdsInOrder,
  type SidebarNavId
} from './sidebar-nav-catalog'

/** @deprecated 使用 ALL_SIDEBAR_NAV_IDS；保留兼容旧引用 */
export const DEFAULT_NAV_IDS = [...ALL_SIDEBAR_NAV_IDS]

export type { SidebarNavId }

const VISIBILITY_CONFIGURED_KEY = 'desktop_sidebar_visibility_configured'
const HIDDEN_ITEMS_KEY = 'desktop_sidebar_hidden_items'
const NAV_ORDER_KEY = 'desktop_sidebar_nav_order'
const MIGRATION_VERSION_KEY = 'desktop_sidebar_mv'
const CURRENT_MIGRATION_VERSION = 3

const ALL_NAV_ID_SET = new Set<string>(ALL_SIDEBAR_NAV_IDS)

export function isSidebarVisibilityConfigured(): boolean {
  return localStorage.getItem(VISIBILITY_CONFIGURED_KEY) === '1'
}

export function markSidebarVisibilityConfigured(): void {
  localStorage.setItem(VISIBILITY_CONFIGURED_KEY, '1')
}

/** 未手动配置前：默认仅显示日记与回忆 */
export function loadHiddenNavItems(): string[] {
  if (!isSidebarVisibilityConfigured()) {
    return [...getDefaultHiddenNavIds()]
  }

  const saved = localStorage.getItem(HIDDEN_ITEMS_KEY)
  if (!saved) return [...getDefaultHiddenNavIds()]

  try {
    const parsed = JSON.parse(saved) as unknown
    if (!Array.isArray(parsed)) return [...getDefaultHiddenNavIds()]
    return parsed.filter((id): id is string => typeof id === 'string' && ALL_NAV_ID_SET.has(id))
  } catch {
    return [...getDefaultHiddenNavIds()]
  }
}

export function persistHiddenNavItems(items: string[]): void {
  localStorage.setItem(HIDDEN_ITEMS_KEY, JSON.stringify(items))
}

export function filterVisibleNavIds(order: string[]): string[] {
  const hidden = new Set(loadHiddenNavItems())
  return order.filter((id) => !hidden.has(id))
}

export { SIDEBAR_NAV_PATHS }

/** 日记区首页：固定为日记列表，不受侧边栏排序影响 */
export const DIARY_HOME_PATH = '/diary'

export function resolveDiaryHomePath(): string {
  return DIARY_HOME_PATH
}

/** 合并迁移：补全新导航项、应用默认隐藏策略 */
export function loadSidebarNavOrder(): string[] {
  const defaults = [...ALL_SIDEBAR_NAV_IDS]
  const saved = localStorage.getItem(NAV_ORDER_KEY)
  let order: string[] = [...defaults]

  if (saved) {
    try {
      const parsed = JSON.parse(saved) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        order = parsed.filter(
          (id): id is string => typeof id === 'string' && ALL_NAV_ID_SET.has(id)
        )
      }
    } catch {
      order = [...defaults]
    }
  }

  const mv = parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || '0', 10)

  if (mv < CURRENT_MIGRATION_VERSION) {
    if (!isSidebarVisibilityConfigured()) {
      persistHiddenNavItems([...getDefaultHiddenNavIds()])
    } else {
      const hidden = new Set(loadHiddenNavItems())
      for (const id of defaults) {
        if (!order.includes(id)) {
          order.push(id)
          hidden.add(id)
        }
      }
      persistHiddenNavItems([...hidden].filter((id) => ALL_NAV_ID_SET.has(id)))
    }

    for (const id of defaults) {
      if (!order.includes(id)) order.push(id)
    }

    order = reorderSyncNavIdsInOrder(order)

    localStorage.setItem(MIGRATION_VERSION_KEY, String(CURRENT_MIGRATION_VERSION))
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order))
    return order
  }

  let changed = false
  for (const id of defaults) {
    if (!order.includes(id)) {
      order.push(id)
      changed = true
    }
  }
  if (changed) {
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order))
  }

  return order
}
