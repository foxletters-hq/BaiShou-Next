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
/** v5：人生关系图 / 伙伴记忆管理收拢为「记忆」 */
const CURRENT_MIGRATION_VERSION = 5

export function migrateSidebarNavIdsToMemory(input: {
  order: readonly string[]
  hidden: readonly string[]
}): { order: string[]; hidden: string[] } {
  const hidden = new Set(input.hidden)
  const graphVisible = input.order.includes('graph') && !hidden.has('graph')
  const ragVisible = input.order.includes('rag') && !hidden.has('rag')
  const memoryAlreadyVisible = input.order.includes('memory') && !hidden.has('memory')
  const memoryVisible = graphVisible || ragVisible || memoryAlreadyVisible

  const order: string[] = []
  let insertedMemory = false
  for (const id of input.order) {
    if (id === 'graph' || id === 'memory') {
      if (!insertedMemory) {
        order.push('memory')
        insertedMemory = true
      }
      continue
    }
    if (id === 'rag') continue
    order.push(id)
  }
  if (!insertedMemory) {
    const summaryIndex = order.indexOf('summary')
    if (summaryIndex >= 0) order.splice(summaryIndex + 1, 0, 'memory')
    else order.push('memory')
  }

  hidden.delete('graph')
  hidden.delete('rag')
  if (memoryVisible) hidden.delete('memory')
  else hidden.add('memory')

  return { order, hidden: [...hidden] }
}

/** 仅从日记区侧边栏移除；仍可通过系统设置访问 */
const REMOVED_SIDEBAR_NAV_IDS = new Set(['legacy-migration'])

const ALL_NAV_ID_SET = new Set<string>(ALL_SIDEBAR_NAV_IDS)

export function isSidebarVisibilityConfigured(): boolean {
  return localStorage.getItem(VISIBILITY_CONFIGURED_KEY) === '1'
}

export function markSidebarVisibilityConfigured(): void {
  localStorage.setItem(VISIBILITY_CONFIGURED_KEY, '1')
}

/** 未手动配置前：默认显示日记、伙伴、回忆、图谱与增量同步 */
export function loadHiddenNavItems(): string[] {
  applySidebarMemoryNavMigration()
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

/** 恢复默认显隐与排序（自定义侧边栏弹窗） */
export function resetSidebarNavToDefaults(): {
  hiddenItems: string[]
  navOrder: string[]
} {
  const hiddenItems = [...getDefaultHiddenNavIds()]
  const navOrder = [...ALL_SIDEBAR_NAV_IDS]
  markSidebarVisibilityConfigured()
  persistHiddenNavItems(hiddenItems)
  localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(navOrder))
  localStorage.setItem(MIGRATION_VERSION_KEY, String(CURRENT_MIGRATION_VERSION))
  return { hiddenItems, navOrder }
}

export function filterVisibleNavIds(order: string[]): string[] {
  const hidden = new Set(loadHiddenNavItems())
  return order.filter((id) => !hidden.has(id))
}

export { SIDEBAR_NAV_PATHS }

function readRawNavList(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

function applySidebarMemoryNavMigration(): void {
  const mv = parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || '0', 10)
  if (mv >= 5) return
  if (!isSidebarVisibilityConfigured()) return
  const rawOrder = readRawNavList(NAV_ORDER_KEY)
  const rawHidden = readRawNavList(HIDDEN_ITEMS_KEY)
  if (rawOrder.length === 0 && rawHidden.length === 0) return
  const migrated = migrateSidebarNavIdsToMemory({
    order: rawOrder.length > 0 ? rawOrder : [...ALL_SIDEBAR_NAV_IDS],
    hidden: rawHidden
  })
  localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(migrated.order))
  persistHiddenNavItems(migrated.hidden.filter((id) => ALL_NAV_ID_SET.has(id)))
}

/** 日记区首页：固定为日记列表，不受侧边栏排序影响 */
export const DIARY_HOME_PATH = '/diary'

export function resolveDiaryHomePath(): string {
  return DIARY_HOME_PATH
}

function stripRemovedSidebarNavIds(order: string[]): string[] {
  return order.filter((id) => !REMOVED_SIDEBAR_NAV_IDS.has(id))
}

function ensureCompanionAfterDiary(order: string[]): string[] {
  if (order.includes('companion')) return order
  const diaryIndex = order.indexOf('diary')
  if (diaryIndex >= 0) {
    const next = [...order]
    next.splice(diaryIndex + 1, 0, 'companion')
    return next
  }
  return ['companion', ...order]
}

/** 合并迁移：补全新导航项、应用默认隐藏策略 */
export function loadSidebarNavOrder(): string[] {
  applySidebarMemoryNavMigration()
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

      // v4：已配置用户也强制露出伙伴、隐藏工作台（入口改到顶栏）
      if (mv < 4) {
        hidden.delete('companion')
        hidden.add('workbench')
      }

      persistHiddenNavItems(
        [...hidden].filter((id) => ALL_NAV_ID_SET.has(id) && !REMOVED_SIDEBAR_NAV_IDS.has(id))
      )
    }

    for (const id of defaults) {
      if (!order.includes(id)) order.push(id)
    }

    order = ensureCompanionAfterDiary(order)
    order = reorderSyncNavIdsInOrder(stripRemovedSidebarNavIds(order))

    if (mv < 3 && !order.includes('workbench')) {
      const diaryIndex = order.indexOf('diary')
      if (diaryIndex >= 0) {
        order.splice(diaryIndex + 1, 0, 'workbench')
      } else {
        order.unshift('workbench')
      }
      order = ensureCompanionAfterDiary(order)
    }

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
  const beforeStripLength = order.length
  order = stripRemovedSidebarNavIds(order)
  if (changed || order.length !== beforeStripLength) {
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order))
  }

  return order
}
