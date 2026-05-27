import { shadowConnectionManager, ShadowIndexRepository } from '@baishou/database'
import { logger, parseDateStr } from '@baishou/shared'

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

/**
 * 构建共同回忆 Markdown 文本。
 * 实现级联过滤逻辑：被高级别总结覆盖的低级别条目会被省略。
 *
 * @param summaries - 所有摘要列表
 * @param lookbackMonths - 回溯月数
 * @param locale - 语言标识
 */
export async function buildSharedContextText(
  summaries: any[],
  lookbackMonths: number,
  locale?: string
): Promise<string> {
  const shadowDb = shadowConnectionManager.getDb()
  if (!shadowDb) return ''

  const shadowRepo = new ShadowIndexRepository(shadowDb as any)
  const diaries = await shadowRepo.listAllWithFTS()

  const now = new Date()
  const cutoffDate = new Date()
  cutoffDate.setMonth(cutoffDate.getMonth() - lookbackMonths)
  cutoffDate.setDate(1)
  cutoffDate.setHours(0, 0, 0, 0)

  const relevantSummaries = (summaries || []).filter((s: any) => new Date(s.endDate) > cutoffDate)
  const relevantDiaries = diaries.filter((d: any) => {
    const dDate = parseDateStr(d.date)
    return dDate >= cutoffDate && dDate <= now
  })

  const yList = relevantSummaries.filter((s: any) => s.type === 'yearly')
  const qList = relevantSummaries.filter((s: any) => s.type === 'quarterly')
  const mList = relevantSummaries.filter((s: any) => s.type === 'monthly')
  const wList = relevantSummaries.filter((s: any) => s.type === 'weekly')

  // 级联过滤：被更高级别总结覆盖的月份集合
  const coveredMonthKeys = new Set<string>()
  for (const q of qList) markMonthsCovered(q, coveredMonthKeys)

  const getMonthKey = (s: any) => {
    const start = new Date(s.startDate)
    return `${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, '0')}`
  }

  const visibleMonths = mList.filter((m: any) => !coveredMonthKeys.has(getMonthKey(m)))
  for (const m of visibleMonths) markMonthsCovered(m, coveredMonthKeys)

  const visibleWeeks = wList.filter((w: any) => {
    const wEnd = new Date(w.endDate)
    const key = `${wEnd.getFullYear()}${String(wEnd.getMonth() + 1).padStart(2, '0')}`
    return !coveredMonthKeys.has(key)
  })

  const diaryCutoffDate =
    visibleWeeks.length > 0
      ? new Date(Math.max(...visibleWeeks.map((w: any) => new Date(w.endDate).getTime())))
      : null

  const visibleDiaries = relevantDiaries.filter((d: any) => {
    const dDate = parseDateStr(d.date)
    const key = `${dDate.getFullYear()}${String(dDate.getMonth() + 1).padStart(2, '0')}`
    if (coveredMonthKeys.has(key)) return false
    if (diaryCutoffDate && dDate <= diaryCutoffDate) return false
    return true
  })

  const tDict = LOCALE_TRANSLATIONS[resolveLocaleKey(locale || 'zh')] ?? LOCALE_TRANSLATIONS['zh']!

  const allItems: { date: Date; data: any; prefix: string }[] = []
  for (const i of yList) allItems.push({ date: new Date(i.startDate), data: i, prefix: tDict.yearly })
  for (const i of qList) allItems.push({ date: new Date(i.startDate), data: i, prefix: tDict.quarterly })
  for (const i of visibleMonths) allItems.push({ date: new Date(i.startDate), data: i, prefix: tDict.monthly })
  for (const i of visibleWeeks) allItems.push({ date: new Date(i.startDate), data: i, prefix: tDict.weekly })
  for (const d of visibleDiaries) allItems.push({ date: parseDateStr(d.date), data: d, prefix: tDict.diary })

  allItems.sort((a, b) => a.date.getTime() - b.date.getTime())
  if (allItems.length === 0) return ''

  const formattedParts = allItems.map((item) => {
    const dateStr = formatDate(item.date)
    const content = item.prefix === tDict.diary ? item.data.rawContent || '' : item.data.content || ''
    return `## ${item.prefix} ${dateStr}\n\n${content}`
  })

  const slang = tDict.slangs[Math.floor(Math.random() * tDict.slangs.length)]!
  const header = `${slang}\n${tDict.subTitle(lookbackMonths)}\n`
  return `${header}\n${formattedParts.join('\n\n---\n\n')}`
}

/**
 * IPC Handler：构建共同回忆文本（带错误捕获）。
 */
export async function handleBuildSharedContext(
  summaries: any[],
  lookbackMonths: number,
  locale?: string
): Promise<string> {
  try {
    return await buildSharedContextText(summaries, lookbackMonths, locale)
  } catch (e) {
    logger.error('[SummaryIPC] buildSharedContext error:', e as any)
    return ''
  }
}
