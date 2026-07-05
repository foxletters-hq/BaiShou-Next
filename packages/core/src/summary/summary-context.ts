import { shadowConnectionManager, ShadowIndexRepository } from '@baishou/database'
import { logger, parseDateStr, type SharedMemoryCopyPreview } from '@baishou/shared'
import { quarterlySummariesForMonthCascade } from './summary-cascade.util'

/** 国际化字典类型 */
interface LocaleDict {
  yearly: string
  quarterly: string
  monthly: string
  weekly: string
  diary: string
  subTitle: (months: number) => string
  slangs: string[]
}

/** 支持语言的国际化字典 */
const LOCALE_TRANSLATIONS: Record<string, LocaleDict> = {
  zh: {
    yearly: '[年总结]',
    quarterly: '[季度总结]',
    monthly: '[月总结]',
    weekly: '[周总结]',
    diary: '[日记]',
    subTitle: (months) => `包含最近 ${months} 个月的关键人生节点记录与回忆`,
    slangs: ['📖 白守 · 共同回忆', '🌸 共同回忆 — 白守', '✨ 白守 | 共同回忆']
  },
  zh_TW: {
    yearly: '[年總結]',
    quarterly: '[季度總結]',
    monthly: '[月總結]',
    weekly: '[周總結]',
    diary: '[日記]',
    subTitle: (months) => `包含最近 ${months} 個月的關鍵人生節點記錄與回憶`,
    slangs: ['📖 白守 · 共同回憶', '🌸 共同回憶 — 白守', '✨ 白守 | 共同回憶']
  },
  en: {
    yearly: '[Yearly Summary]',
    quarterly: '[Quarterly Summary]',
    monthly: '[Monthly Summary]',
    weekly: '[Weekly Summary]',
    diary: '[Diary]',
    subTitle: (months) => `Includes key life events and memories from the past ${months} months`,
    slangs: [
      '📖 BaiShou · Shared Memories',
      '🌸 Shared Memories — BaiShou',
      '✨ BaiShou | Shared Memories'
    ]
  },
  ja: {
    yearly: '[年次のまとめ]',
    quarterly: '[四半期のまとめ]',
    monthly: '[月次のまとめ]',
    weekly: '[週次のまとめ]',
    diary: '[日記]',
    subTitle: (months) => `過去 ${months} ヶ月間の主要な人生の節目と记录を含みます`,
    slangs: ['📖 白守 · 共同の思い出', '🌸 共同の思い出 — 白守', '✨ 白守 | 共同の思い出']
  }
}

/** 解析 locale 字符串，返回标准化的语言键 */
function resolveLocaleKey(locale: string): string {
  const normalized = (locale || 'zh').toLowerCase().replace('-', '_')
  if (normalized.startsWith('zh_tw') || normalized.startsWith('zh_hk')) return 'zh_TW'
  if (normalized.startsWith('zh')) return 'zh'
  if (normalized.startsWith('en')) return 'en'
  if (normalized.startsWith('ja')) return 'ja'
  return 'zh'
}

/** 格式化日期为 YYYY-MM-DD */
const formatDate = (d: Date): string => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 将总结覆盖的月份打入覆盖集合（用于级联过滤） */
function markMonthsCovered(s: any, coveredMonthKeys: Set<string>): void {
  const start = new Date(s.startDate)
  const end = new Date(s.endDate)
  let current = new Date(start.getFullYear(), start.getMonth(), 1)
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
  while (current <= endMonth) {
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, '0')
    coveredMonthKeys.add(`${year}${month}`)
    current.setMonth(current.getMonth() + 1)
  }
}

export type SharedContextDiaryRow = {
  date: string
  rawContent?: string | null
}

type SharedContextSummaryRow = {
  type: string
  startDate: string | Date
  endDate: string | Date
  content?: string | null
}

type SharedMemoryItemKind = 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'diary'

type ResolvedSharedMemoryItems = {
  yList: SharedContextSummaryRow[]
  qList: SharedContextSummaryRow[]
  visibleMonths: SharedContextSummaryRow[]
  visibleWeeks: SharedContextSummaryRow[]
  visibleDiaries: SharedContextDiaryRow[]
  allItems: { date: Date; data: any; kind: SharedMemoryItemKind }[]
}

function resolveSharedMemoryItems(
  summaries: SharedContextSummaryRow[],
  diaries: SharedContextDiaryRow[],
  lookbackMonths: number
): ResolvedSharedMemoryItems {
  const now = new Date()
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - lookbackMonths)
  cutoffDate.setDate(1)
  cutoffDate.setHours(0, 0, 0, 0)

  const relevantSummaries = (summaries || []).filter((s) => new Date(s.endDate) > cutoffDate)
  const relevantDiaries = diaries.filter((d) => {
    const dDate = parseDateStr(d.date)
    return dDate >= cutoffDate && dDate <= now
  })

  const yList = relevantSummaries.filter((s) => s.type === 'yearly')
  const qList = relevantSummaries.filter((s) => s.type === 'quarterly')
  const mList = relevantSummaries.filter((s) => s.type === 'monthly')
  const wList = relevantSummaries.filter((s) => s.type === 'weekly')

  const coveredMonthKeys = new Set<string>()
  for (const q of quarterlySummariesForMonthCascade(qList)) markMonthsCovered(q, coveredMonthKeys)

  const getMonthKey = (s: SharedContextSummaryRow) => {
    const start = new Date(s.startDate)
    return `${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, '0')}`
  }

  const visibleMonths = mList.filter((m) => !coveredMonthKeys.has(getMonthKey(m)))
  for (const m of visibleMonths) markMonthsCovered(m, coveredMonthKeys)

  const visibleWeeks = wList.filter((w) => {
    const wEnd = new Date(w.endDate)
    const key = `${wEnd.getFullYear()}${String(wEnd.getMonth() + 1).padStart(2, '0')}`
    return !coveredMonthKeys.has(key)
  })

  const diaryCutoffDate =
    visibleWeeks.length > 0
      ? new Date(Math.max(...visibleWeeks.map((w) => new Date(w.endDate).getTime())))
      : null

  const visibleDiaries = relevantDiaries.filter((d) => {
    const dDate = parseDateStr(d.date)
    const key = `${dDate.getFullYear()}${String(dDate.getMonth() + 1).padStart(2, '0')}`
    if (coveredMonthKeys.has(key)) return false
    if (diaryCutoffDate && dDate <= diaryCutoffDate) return false
    return true
  })

  const allItems: ResolvedSharedMemoryItems['allItems'] = []
  for (const i of yList) allItems.push({ date: new Date(i.startDate), data: i, kind: 'yearly' })
  for (const i of qList) allItems.push({ date: new Date(i.startDate), data: i, kind: 'quarterly' })
  for (const i of visibleMonths)
    allItems.push({ date: new Date(i.startDate), data: i, kind: 'monthly' })
  for (const i of visibleWeeks)
    allItems.push({ date: new Date(i.startDate), data: i, kind: 'weekly' })
  for (const d of visibleDiaries)
    allItems.push({ date: parseDateStr(d.date), data: d, kind: 'diary' })

  allItems.sort((a, b) => a.date.getTime() - b.date.getTime())

  return { yList, qList, visibleMonths, visibleWeeks, visibleDiaries, allItems }
}

export function computeSharedMemoryCopyPreview(
  summaries: SharedContextSummaryRow[],
  diaries: SharedContextDiaryRow[],
  lookbackMonths: number
): SharedMemoryCopyPreview {
  const { yList, qList, visibleMonths, visibleWeeks, visibleDiaries } = resolveSharedMemoryItems(
    summaries,
    diaries,
    lookbackMonths
  )

  const yearly = yList.length
  const quarterly = qList.length
  const monthly = visibleMonths.length
  const weekly = visibleWeeks.length
  const diary = visibleDiaries.length

  return {
    lookbackMonths,
    yearly,
    quarterly,
    monthly,
    weekly,
    diary,
    total: yearly + quarterly + monthly + weekly + diary
  }
}

/**
 * 构建共同回忆 Markdown 文本。
 * 实现级联过滤逻辑：被高级别总结覆盖的低级别条目会被省略。
 */
export async function buildSharedContextText(
  summaries: any[],
  lookbackMonths: number,
  locale?: string,
  options?: { diaries?: SharedContextDiaryRow[]; vaultName?: string }
): Promise<string> {
  let diaries: SharedContextDiaryRow[]
  if (options?.diaries) {
    diaries = options.diaries
  } else {
    const shadowDb = shadowConnectionManager.getDb()
    if (!shadowDb || !options?.vaultName) return ''

    const shadowRepo = new ShadowIndexRepository(shadowDb as any, options.vaultName)
    diaries = await shadowRepo.listAllWithFTS()
  }


  const tDict = LOCALE_TRANSLATIONS[resolveLocaleKey(locale || 'zh')] ?? LOCALE_TRANSLATIONS['zh']!
  const { allItems } = resolveSharedMemoryItems(summaries, diaries, lookbackMonths)

  if (allItems.length === 0) return ''

  const prefixByKind: Record<SharedMemoryItemKind, string> = {
    yearly: tDict.yearly,
    quarterly: tDict.quarterly,
    monthly: tDict.monthly,
    weekly: tDict.weekly,
    diary: tDict.diary
  }

  const formattedParts = allItems.map((item) => {
    const dateStr = formatDate(item.date)
    const prefix = prefixByKind[item.kind]
    const content =
      item.kind === 'diary' ? item.data.rawContent || '' : item.data.content || ''
    return `## ${prefix} ${dateStr}\n\n${content}`
  })

  const slang = tDict.slangs[Math.floor(Math.random() * tDict.slangs.length)]!
  const header = `${slang}\n${tDict.subTitle(lookbackMonths)}\n`
  return `${header}\n${formattedParts.join('\n\n---\n\n')}`
}

export async function handleBuildSharedContext(
  summaries: any[],
  lookbackMonths: number,
  locale?: string,
  vaultName?: string
): Promise<string> {
  try {
    return await buildSharedContextText(summaries, lookbackMonths, locale, { vaultName })
  } catch (e) {
    logger.error('[SummaryIPC] buildSharedContext error:', e as any)
    return ''
  }
}

export async function handleBuildSharedContextPreview(
  summaries: any[],
  lookbackMonths: number,
  vaultName?: string
): Promise<SharedMemoryCopyPreview> {
  try {
    const shadowDb = shadowConnectionManager.getDb()
    if (!shadowDb || !vaultName) {
      return {
        lookbackMonths,
        yearly: 0,
        quarterly: 0,
        monthly: 0,
        weekly: 0,
        diary: 0,
        total: 0
      }
    }

    const shadowRepo = new ShadowIndexRepository(shadowDb as any, vaultName)
    const diaries = await shadowRepo.listAllWithFTS()
    return computeSharedMemoryCopyPreview(summaries, diaries, lookbackMonths)
  } catch (e) {
    logger.error('[SummaryIPC] buildSharedContextPreview error:', e as any)
    return {
      lookbackMonths,
      yearly: 0,
      quarterly: 0,
      monthly: 0,
      weekly: 0,
      diary: 0,
      total: 0
    }
  }
}
