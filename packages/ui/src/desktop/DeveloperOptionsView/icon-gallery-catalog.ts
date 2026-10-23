import i18n from 'i18next'
import type { LucideIcon } from 'lucide-react'
import lucideIconMeta from './lucide-icon-meta.json'
import { USED_LUCIDE_ICON_NAMES } from './used-lucide-icons'

export type IconGalleryEntry = {
  name: string
  Icon: LucideIcon
  used: boolean
  tags: string[]
}

export type IconGalleryGroup = {
  id: string
  items: IconGalleryEntry[]
}

export type IconGallerySection = {
  id: string
  items: IconGalleryEntry[]
  groups?: IconGalleryGroup[]
}

type LucideIconMetaFile = {
  categoryOrder: string[]
  icons: Record<string, { categories?: string[]; tags?: string[] }>
}

const META = lucideIconMeta as LucideIconMetaFile
const USED_SET = new Set<string>(USED_LUCIDE_ICON_NAMES)

export const LUCIDE_CATEGORY_ORDER = META.categoryOrder

export const LUCIDE_CATEGORY_LABELS: Record<string, string> = {
  used: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L34',
    '软件已使用'
  ),
  uncategorized: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L35',
    '未分组'
  ),
  accessibility: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L36',
    '无障碍'
  ),
  account: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L37',
    '账户'
  ),
  animals: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L38',
    '动物'
  ),
  arrows: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L39',
    '箭头'
  ),
  buildings: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L40',
    '建筑'
  ),
  charts: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L41',
    '图表'
  ),
  communication: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L42',
    '沟通'
  ),
  connectivity: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L43',
    '连接'
  ),
  cursors: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L44',
    '光标'
  ),
  design: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L45',
    '设计'
  ),
  development: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L46',
    '开发'
  ),
  devices: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L47',
    '设备'
  ),
  emoji: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L48',
    '表情'
  ),
  files: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L49',
    '文件'
  ),
  finance: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L50',
    '财务'
  ),
  'food-beverage': i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L51',
    '饮食'
  ),
  gaming: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L52',
    '游戏'
  ),
  home: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L53',
    '家居'
  ),
  layout: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L54',
    '布局'
  ),
  mail: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L55',
    '邮件'
  ),
  math: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L56',
    '数学'
  ),
  medical: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L57',
    '医疗'
  ),
  multimedia: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L58',
    '多媒体'
  ),
  nature: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L59',
    '自然'
  ),
  navigation: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L60',
    '导航'
  ),
  notifications: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L61',
    '通知'
  ),
  people: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L62',
    '人物'
  ),
  photography: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L63',
    '摄影'
  ),
  science: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L64',
    '科学'
  ),
  seasons: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L65',
    '季节'
  ),
  security: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L66',
    '安全'
  ),
  shapes: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L67',
    '形状'
  ),
  shopping: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L68',
    '购物'
  ),
  social: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L69',
    '社交'
  ),
  sports: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L70',
    '运动'
  ),
  sustainability: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L71',
    '可持续'
  ),
  text: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L72',
    '文本'
  ),
  time: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L73',
    '时间'
  ),
  tools: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L74',
    '工具'
  ),
  transportation: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L75',
    '交通'
  ),
  travel: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L76',
    '出行'
  ),
  weather: i18n.t(
    'auto.packages.ui.src.desktop.DeveloperOptionsView.icon.gallery.catalog.L77',
    '天气'
  )
}

function isLucideIcon(value: unknown): value is LucideIcon {
  return typeof value === 'function' || (typeof value === 'object' && value !== null)
}

function iconTags(name: string): string[] {
  const tags = META.icons[name]?.tags
  return Array.isArray(tags) ? tags : []
}

function iconCategories(name: string): string[] {
  const categories = META.icons[name]?.categories
  return Array.isArray(categories) ? categories : []
}

export function listLucideIconNames(lucideIcons: Record<string, unknown>): string[] {
  return Object.keys(lucideIcons)
    .filter((name) => /^[A-Z]/.test(name) && isLucideIcon(lucideIcons[name]))
    .sort((a, b) => a.localeCompare(b))
}

export function entryMatchesQuery(
  entry: Pick<IconGalleryEntry, 'name' | 'tags'>,
  query: string
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (entry.name.toLowerCase().includes(needle)) return true
  return entry.tags.some((tag) => tag.toLowerCase().includes(needle))
}

function toEntry(name: string, lucideIcons: Record<string, unknown>): IconGalleryEntry | null {
  const Icon = lucideIcons[name]
  if (!isLucideIcon(Icon)) return null
  return {
    name,
    Icon,
    used: USED_SET.has(name),
    tags: iconTags(name)
  }
}

/** 顶部「已使用」与下方分类各自独立；已使用的图标仍出现在对应分类中。 */
export function buildIconGallerySections(input: {
  lucideIcons: Record<string, unknown>
  resolveIcons?: Record<string, unknown>
  query?: string
}): IconGallerySection[] {
  const query = input.query ?? ''
  const resolveIcons = input.resolveIcons ?? input.lucideIcons
  const allNames = listLucideIconNames(input.lucideIcons)
  const allNameSet = new Set(allNames)

  const usedItems = USED_LUCIDE_ICON_NAMES.map((name) => toEntry(name, resolveIcons)).filter(
    (item): item is IconGalleryEntry => item !== null && entryMatchesQuery(item, query)
  )

  const namesByCategory = new Map<string, string[]>()
  for (const id of LUCIDE_CATEGORY_ORDER) namesByCategory.set(id, [])
  const uncategorized: string[] = []

  for (const name of allNames) {
    const categories = iconCategories(name).filter((id) => namesByCategory.has(id))
    if (categories.length === 0) {
      uncategorized.push(name)
      continue
    }
    for (const id of categories) {
      namesByCategory.get(id)?.push(name)
    }
  }

  for (const name of USED_LUCIDE_ICON_NAMES) {
    if (allNameSet.has(name)) continue
    const extra = toEntry(name, resolveIcons)
    if (!extra || !entryMatchesQuery(extra, query)) continue
    if (!usedItems.some((item) => item.name === name)) usedItems.push(extra)
  }

  const sections: IconGallerySection[] = [
    { id: 'used', items: usedItems, groups: groupUsedItemsByCategory(usedItems) }
  ]

  for (const id of LUCIDE_CATEGORY_ORDER) {
    const items = (namesByCategory.get(id) ?? [])
      .map((name) => toEntry(name, resolveIcons))
      .filter((item): item is IconGalleryEntry => item !== null && entryMatchesQuery(item, query))
    sections.push({ id, items })
  }

  const uncategorizedItems = uncategorized
    .map((name) => toEntry(name, resolveIcons))
    .filter((item): item is IconGalleryEntry => item !== null && entryMatchesQuery(item, query))
  sections.push({ id: 'uncategorized', items: uncategorizedItems })

  return sections
}

export function iconGallerySectionLabel(id: string): string {
  return LUCIDE_CATEGORY_LABELS[id] ?? id
}

/** 已使用图标按官方分类归组；多分类时只放进第一个分类，避免组内重复。 */
export function groupUsedItemsByCategory(items: IconGalleryEntry[]): IconGalleryGroup[] {
  const buckets = new Map<string, IconGalleryEntry[]>()
  for (const id of LUCIDE_CATEGORY_ORDER) buckets.set(id, [])
  buckets.set('uncategorized', [])

  for (const item of items) {
    const first = iconCategories(item.name).find((id) => buckets.has(id))
    buckets.get(first ?? 'uncategorized')?.push(item)
  }

  return [...LUCIDE_CATEGORY_ORDER, 'uncategorized']
    .map((id) => ({ id, items: buckets.get(id) ?? [] }))
    .filter((group) => group.items.length > 0)
}
