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
  used: '软件已使用',
  uncategorized: '未分组',
  accessibility: '无障碍',
  account: '账户',
  animals: '动物',
  arrows: '箭头',
  buildings: '建筑',
  charts: '图表',
  communication: '沟通',
  connectivity: '连接',
  cursors: '光标',
  design: '设计',
  development: '开发',
  devices: '设备',
  emoji: '表情',
  files: '文件',
  finance: '财务',
  'food-beverage': '饮食',
  gaming: '游戏',
  home: '家居',
  layout: '布局',
  mail: '邮件',
  math: '数学',
  medical: '医疗',
  multimedia: '多媒体',
  nature: '自然',
  navigation: '导航',
  notifications: '通知',
  people: '人物',
  photography: '摄影',
  science: '科学',
  seasons: '季节',
  security: '安全',
  shapes: '形状',
  shopping: '购物',
  social: '社交',
  sports: '运动',
  sustainability: '可持续',
  text: '文本',
  time: '时间',
  tools: '工具',
  transportation: '交通',
  travel: '出行',
  weather: '天气'
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
