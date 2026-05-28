/** 左侧主导航默认项（默认全部显示） */
export const DEFAULT_NAV_IDS = ['diary', 'summary', 'incr-sync', 'sync', 'lan', 'git'] as const

export type SidebarNavId = (typeof DEFAULT_NAV_IDS)[number]

const VISIBILITY_CONFIGURED_KEY = 'desktop_sidebar_visibility_configured'
const HIDDEN_ITEMS_KEY = 'desktop_sidebar_hidden_items'

const DEFAULT_NAV_ID_SET = new Set<string>(DEFAULT_NAV_IDS)

export function isSidebarVisibilityConfigured(): boolean {
  return localStorage.getItem(VISIBILITY_CONFIGURED_KEY) === '1'
}

export function markSidebarVisibilityConfigured(): void {
  localStorage.setItem(VISIBILITY_CONFIGURED_KEY, '1')
}

/** 未手动配置前返回空数组，即默认展示全部导航项 */
export function loadHiddenNavItems(): string[] {
  if (!isSidebarVisibilityConfigured()) {
    return []
  }

  const saved = localStorage.getItem(HIDDEN_ITEMS_KEY)
  if (!saved) return []

  try {
    const parsed = JSON.parse(saved) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && DEFAULT_NAV_ID_SET.has(id))
  } catch {
    return []
  }
}

export function persistHiddenNavItems(items: string[]): void {
  localStorage.setItem(HIDDEN_ITEMS_KEY, JSON.stringify(items))
}

export function filterVisibleNavIds(order: string[]): string[] {
  const hidden = new Set(loadHiddenNavItems())
  return order.filter((id) => !hidden.has(id))
}

export const SIDEBAR_NAV_PATHS: Record<string, string> = {
  diary: '/diary',
  summary: '/summary',
  lan: '/lan-transfer',
  sync: '/data-sync',
  'incr-sync': '/incremental-sync',
  git: '/git'
}

/** 默认展示全部项时，取排序后第一个可见路由 */
export function resolveFirstVisibleSidebarPath(): string {
  const saved = localStorage.getItem('desktop_sidebar_nav_order')
  let order: string[] = [...DEFAULT_NAV_IDS]
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        order = parsed.filter((id): id is string => typeof id === 'string')
      }
    } catch {
      /* use default order */
    }
  }

  const visible = filterVisibleNavIds(order)
  const firstId = visible[0]
  if (firstId && SIDEBAR_NAV_PATHS[firstId]) {
    return SIDEBAR_NAV_PATHS[firstId]
  }
  return '/diary'
}
