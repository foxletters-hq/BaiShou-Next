import { SummaryType, type MissingSummary } from '../types/summary.types'
import { formatLocalDate, getSummaryWeekNumber, parseDateStr } from './date.utils'

export interface DetectableDiaryItem {
  date: Date
}

export interface DetectableSummaryItem {
  type: SummaryType | string
  startDate: Date
  endDate: Date
}

export interface ResolvedSummaryPeriodBounds {
  type: SummaryType
  startDate: Date
  endDate: Date
  startDateIso: string
  endDateIso: string
  label: string
  relativePath: string
  weekNumber?: number
  quarter?: number
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 与 SummaryGeneratorService 构建上下文时的区间判断保持一致 */
export function summaryFullyWithinPeriod(
  summary: Pick<DetectableSummaryItem, 'startDate' | 'endDate'>,
  periodStart: Date,
  periodEnd: Date
): boolean {
  return (
    summary.startDate.getTime() >= periodStart.getTime() &&
    summary.endDate.getTime() <= periodEnd.getTime()
  )
}

function monthBounds(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0, 23, 59, 59)
  }
}

export function formatSummaryPeriodLabel(
  type: SummaryType,
  date: Date,
  locale: string = 'zh',
  options?: { week?: number; quarter?: number }
): string {
  const isEn = locale.startsWith('en')
  const isJa = locale.startsWith('ja')

  if (isEn) {
    if (type === SummaryType.weekly) return `Week ${options?.week}, ${date.getFullYear()}`
    if (type === SummaryType.monthly) return `${date.getMonth() + 1}/${date.getFullYear()}`
    if (type === SummaryType.quarterly) return `${date.getFullYear()} Q${options?.quarter}`
    if (type === SummaryType.yearly) return `Year ${date.getFullYear()}`
  } else if (isJa) {
    if (type === SummaryType.weekly) return `${date.getFullYear()}年 第${options?.week}週`
    if (type === SummaryType.monthly) return `${date.getFullYear()}年${date.getMonth() + 1}月`
    if (type === SummaryType.quarterly) return `${date.getFullYear()}年 Q${options?.quarter}`
    if (type === SummaryType.yearly) return `${date.getFullYear()}年度`
  }

  if (type === SummaryType.weekly) return `${date.getFullYear()}年第${options?.week}周`
  if (type === SummaryType.monthly) return `${date.getFullYear()}年${date.getMonth() + 1}月`
  if (type === SummaryType.quarterly) return `${date.getFullYear()}年Q${options?.quarter}`
  if (type === SummaryType.yearly) return `${date.getFullYear()}年度`
  return ''
}

function summaryCoversWeek(
  summary: DetectableSummaryItem,
  weekStart: Date,
  weekEnd: Date
): boolean {
  return (
    summary.startDate.getTime() <= weekEnd.getTime() &&
    summary.endDate.getTime() >= weekStart.getTime()
  )
}

function getMissingWeekly(
  diaries: ReadonlyArray<DetectableDiaryItem>,
  existingSummaries: ReadonlyArray<DetectableSummaryItem>,
  locale: string,
  now: Date
): MissingSummary[] {
  if (diaries.length === 0) return []
  const missing: MissingSummary[] = []
  const dates = diaries.map((d) => d.date.getTime()).sort((a, b) => a - b)
  const firstDate = new Date(dates[0]!)

  const dayOfWeek = firstDate.getDay()
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  let currentStart = new Date(
    firstDate.getFullYear(),
    firstDate.getMonth(),
    firstDate.getDate() - diff
  )

  while (true) {
    const currentEnd = new Date(
      currentStart.getFullYear(),
      currentStart.getMonth(),
      currentStart.getDate() + 6,
      23,
      59,
      59
    )

    if (currentEnd.getTime() > now.getTime()) break

    const hasEntry = dates.some(
      (timestamp) => timestamp >= currentStart.getTime() && timestamp <= currentEnd.getTime()
    )

    if (hasEntry) {
      const hasSummary = existingSummaries.some((s) =>
        summaryCoversWeek(s, currentStart, currentEnd)
      )

      if (!hasSummary) {
        const weekNum = getSummaryWeekNumber(currentStart)
        missing.push({
          type: SummaryType.weekly,
          startDate: new Date(currentStart),
          endDate: new Date(currentEnd),
          label: formatSummaryPeriodLabel(SummaryType.weekly, currentStart, locale, {
            week: weekNum
          }),
          weekNumber: weekNum
        })
      }
    }

    currentStart = new Date(
      currentStart.getFullYear(),
      currentStart.getMonth(),
      currentStart.getDate() + 7
    )
    if (currentStart.getFullYear() > now.getFullYear() + 1) break
  }
  return missing
}

function getMissingMonthly(
  weeklies: ReadonlyArray<DetectableSummaryItem>,
  monthlies: ReadonlyArray<DetectableSummaryItem>,
  locale: string,
  now: Date
): MissingSummary[] {
  if (weeklies.length === 0) return []
  const missing: MissingSummary[] = []

  const monthsSet = new Set<string>()
  for (const w of weeklies) {
    if (w.type !== SummaryType.weekly) continue
    const year = w.startDate.getFullYear()
    const month = w.startDate.getMonth()
    const { start: mStart, end: mEnd } = monthBounds(year, month)
    if (!summaryFullyWithinPeriod(w, mStart, mEnd)) continue
    monthsSet.add(`${year}-${month}`)
  }

  for (const key of monthsSet) {
    const [yearStr, monthStr] = key.split('-')
    const year = parseInt(yearStr!, 10)
    const month = parseInt(monthStr!, 10)

    const { start: mStart, end: mEnd } = monthBounds(year, month)

    if (mEnd.getTime() > now.getTime()) continue

    const eligibleWeeklies = weeklies.filter(
      (w) => w.type === SummaryType.weekly && summaryFullyWithinPeriod(w, mStart, mEnd)
    )
    if (eligibleWeeklies.length === 0) continue

    const hasMonthly = monthlies.some(
      (s) => s.startDate.getFullYear() === year && s.startDate.getMonth() === month
    )

    if (!hasMonthly) {
      missing.push({
        type: SummaryType.monthly,
        startDate: mStart,
        endDate: mEnd,
        label: formatSummaryPeriodLabel(SummaryType.monthly, mStart, locale)
      })
    }
  }
  return missing
}

function getMissingMonthlyFromDiaries(
  diaries: ReadonlyArray<DetectableDiaryItem>,
  monthlies: ReadonlyArray<DetectableSummaryItem>,
  locale: string,
  now: Date
): MissingSummary[] {
  if (diaries.length === 0) return []
  const missing: MissingSummary[] = []

  const monthsSet = new Set<string>()
  for (const d of diaries) {
    const year = d.date.getFullYear()
    const month = d.date.getMonth()
    monthsSet.add(`${year}-${month}`)
  }

  for (const key of monthsSet) {
    const [yearStr, monthStr] = key.split('-')
    const year = parseInt(yearStr!, 10)
    const month = parseInt(monthStr!, 10)
    const { start: mStart, end: mEnd } = monthBounds(year, month)

    if (mEnd.getTime() > now.getTime()) continue

    const hasDiaryInMonth = diaries.some(
      (d) => d.date.getTime() >= mStart.getTime() && d.date.getTime() <= mEnd.getTime()
    )
    if (!hasDiaryInMonth) continue

    const hasMonthly = monthlies.some(
      (s) => s.startDate.getFullYear() === year && s.startDate.getMonth() === month
    )

    if (!hasMonthly) {
      missing.push({
        type: SummaryType.monthly,
        startDate: mStart,
        endDate: mEnd,
        label: formatSummaryPeriodLabel(SummaryType.monthly, mStart, locale)
      })
    }
  }
  return missing
}

function mergeMissingMonthlyByMonth(a: MissingSummary[], b: MissingSummary[]): MissingSummary[] {
  const map = new Map<string, MissingSummary>()
  for (const item of [...a, ...b]) {
    const key = `${item.startDate.getFullYear()}-${item.startDate.getMonth()}`
    if (!map.has(key)) map.set(key, item)
  }
  return [...map.values()]
}

function getMissingQuarterly(
  monthlies: ReadonlyArray<DetectableSummaryItem>,
  quarterlies: ReadonlyArray<DetectableSummaryItem>,
  locale: string,
  now: Date
): MissingSummary[] {
  if (monthlies.length === 0) return []
  const missing: MissingSummary[] = []

  const quartersSet = new Set<string>()
  for (const m of monthlies) {
    if (m.type !== SummaryType.monthly) continue
    const year = m.startDate.getFullYear()
    const month = m.startDate.getMonth()
    const { start: mStart, end: mEnd } = monthBounds(year, month)
    if (!summaryFullyWithinPeriod(m, mStart, mEnd)) continue
    const q = Math.ceil((month + 1) / 3)
    quartersSet.add(`${year}-${q}`)
  }

  for (const qKey of quartersSet) {
    const [yearStr, qStr] = qKey.split('-')
    const year = parseInt(yearStr!, 10)
    const quarter = parseInt(qStr!, 10)

    const startMonth = (quarter - 1) * 3
    const qStart = new Date(year, startMonth, 1)
    const qEnd = new Date(year, startMonth + 3, 0, 23, 59, 59)

    if (qEnd.getTime() > now.getTime()) continue

    const eligibleMonthlies = monthlies.filter(
      (m) => m.type === SummaryType.monthly && summaryFullyWithinPeriod(m, qStart, qEnd)
    )
    if (eligibleMonthlies.length === 0) continue

    const hasQuarterly = quarterlies.some(
      (s) =>
        s.type === SummaryType.quarterly &&
        s.startDate.getFullYear() === year &&
        Math.ceil((s.startDate.getMonth() + 1) / 3) === quarter
    )

    if (!hasQuarterly) {
      missing.push({
        type: SummaryType.quarterly,
        startDate: qStart,
        endDate: qEnd,
        label: formatSummaryPeriodLabel(SummaryType.quarterly, qStart, locale, {
          quarter
        })
      })
    }
  }
  return missing
}

function getMissingYearly(
  quarterlies: ReadonlyArray<DetectableSummaryItem>,
  yearlies: ReadonlyArray<DetectableSummaryItem>,
  locale: string,
  now: Date
): MissingSummary[] {
  if (quarterlies.length === 0) return []
  const missing: MissingSummary[] = []

  const yearsSet = new Set<number>()
  for (const q of quarterlies) {
    if (q.type !== SummaryType.quarterly) continue
    const year = q.startDate.getFullYear()
    const yStart = new Date(year, 0, 1)
    const yEnd = new Date(year, 11, 31, 23, 59, 59)
    if (!summaryFullyWithinPeriod(q, yStart, yEnd)) continue
    yearsSet.add(year)
  }

  for (const year of yearsSet) {
    const yStart = new Date(year, 0, 1)
    const yEnd = new Date(year, 11, 31, 23, 59, 59)

    if (yEnd.getTime() > now.getTime()) continue

    const eligibleQuarterlies = quarterlies.filter(
      (q) => q.type === SummaryType.quarterly && summaryFullyWithinPeriod(q, yStart, yEnd)
    )
    if (eligibleQuarterlies.length === 0) continue

    const hasYearly = yearlies.some(
      (s) => s.type === SummaryType.yearly && s.startDate.getFullYear() === year
    )

    if (!hasYearly) {
      missing.push({
        type: SummaryType.yearly,
        startDate: yStart,
        endDate: yEnd,
        label: formatSummaryPeriodLabel(SummaryType.yearly, yStart, locale)
      })
    }
  }
  return missing
}

/**
 * 复用位图与级联规则计算缺失的周记、月报、季报、年度总结。
 */
export function detectMissingSummaries(
  diaries: ReadonlyArray<DetectableDiaryItem>,
  summaries: ReadonlyArray<DetectableSummaryItem>,
  locale: string = 'zh',
  monthlySummarySource: 'weeklies' | 'diaries' = 'weeklies',
  now: Date = new Date()
): MissingSummary[] {
  const summaryMap: Record<string, DetectableSummaryItem[]> = {
    [SummaryType.weekly]: [],
    [SummaryType.monthly]: [],
    [SummaryType.quarterly]: [],
    [SummaryType.yearly]: []
  }

  for (const s of summaries) {
    ;(summaryMap[s.type] ??= []).push(s)
  }

  const weekly = getMissingWeekly(diaries, summaryMap[SummaryType.weekly] ?? [], locale, now)
  const monthlies = summaryMap[SummaryType.monthly] ?? []
  const weeklies = summaryMap[SummaryType.weekly] ?? []
  const monthlyFromWeeklies = getMissingMonthly(weeklies, monthlies, locale, now)
  const monthly =
    monthlySummarySource === 'diaries'
      ? mergeMissingMonthlyByMonth(
          monthlyFromWeeklies,
          getMissingMonthlyFromDiaries(diaries, monthlies, locale, now)
        )
      : monthlyFromWeeklies
  const quarterly = getMissingQuarterly(
    monthlies,
    summaryMap[SummaryType.quarterly] ?? [],
    locale,
    now
  )
  const yearly = getMissingYearly(
    summaryMap[SummaryType.quarterly] ?? [],
    summaryMap[SummaryType.yearly] ?? [],
    locale,
    now
  )

  const result = [...weekly, ...monthly, ...quarterly, ...yearly]
  result.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  return result
}

/**
 * 根据总结类型与起始日期（YYYY-MM-DD）解析规范化的起止时间、展示标签与 Summaries/ 相对路径。
 */
export function resolveSummaryPeriodBounds(
  type: SummaryType,
  startDateInput: string | Date,
  endDateInput?: string | Date | null,
  locale: string = 'zh'
): ResolvedSummaryPeriodBounds | null {
  let rawStart: Date
  if (startDateInput instanceof Date) {
    rawStart = startDateInput
  } else {
    const trimmed = String(startDateInput ?? '').trim()
    if (!ISO_DATE_RE.test(trimmed)) return null
    rawStart = parseDateStr(trimmed)
  }
  if (Number.isNaN(rawStart.getTime())) return null

  const year = rawStart.getFullYear()
  const month = rawStart.getMonth()
  const day = rawStart.getDate()
  const typeDirName = type.charAt(0).toUpperCase() + type.slice(1)

  if (type === SummaryType.yearly) {
    const startDate = new Date(year, 0, 1, 0, 0, 0)
    const endDate = new Date(year, 11, 31, 23, 59, 59)
    const startDateIso = formatLocalDate(startDate)
    const endDateIso = formatLocalDate(endDate)
    return {
      type,
      startDate,
      endDate,
      startDateIso,
      endDateIso,
      label: formatSummaryPeriodLabel(type, startDate, locale),
      relativePath: `${typeDirName}/${startDateIso}.md`
    }
  }

  if (type === SummaryType.quarterly) {
    const quarter = Math.floor(month / 3) + 1
    const startMonth = (quarter - 1) * 3
    const startDate = new Date(year, startMonth, 1, 0, 0, 0)
    const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59)
    const startDateIso = formatLocalDate(startDate)
    const endDateIso = formatLocalDate(endDate)
    return {
      type,
      startDate,
      endDate,
      startDateIso,
      endDateIso,
      label: formatSummaryPeriodLabel(type, startDate, locale, { quarter }),
      relativePath: `${typeDirName}/${year}/${startDateIso}.md`,
      quarter
    }
  }

  if (type === SummaryType.monthly) {
    const startDate = new Date(year, month, 1, 0, 0, 0)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59)
    const startDateIso = formatLocalDate(startDate)
    const endDateIso = formatLocalDate(endDate)
    return {
      type,
      startDate,
      endDate,
      startDateIso,
      endDateIso,
      label: formatSummaryPeriodLabel(type, startDate, locale),
      relativePath: `${typeDirName}/${year}/${startDateIso}.md`
    }
  }

  const startDate = new Date(year, month, day, 0, 0, 0)
  let endDate = new Date(year, month, day + 6, 23, 59, 59)
  if (endDateInput instanceof Date && !Number.isNaN(endDateInput.getTime())) {
    endDate = new Date(
      endDateInput.getFullYear(),
      endDateInput.getMonth(),
      endDateInput.getDate(),
      23,
      59,
      59
    )
  } else if (typeof endDateInput === 'string' && ISO_DATE_RE.test(endDateInput.trim())) {
    const parsedEnd = parseDateStr(endDateInput.trim())
    endDate = new Date(
      parsedEnd.getFullYear(),
      parsedEnd.getMonth(),
      parsedEnd.getDate(),
      23,
      59,
      59
    )
  }
  const startDateIso = formatLocalDate(startDate)
  const endDateIso = formatLocalDate(endDate)
  const weekNumber = getSummaryWeekNumber(startDate)
  return {
    type,
    startDate,
    endDate,
    startDateIso,
    endDateIso,
    label: formatSummaryPeriodLabel(type, startDate, locale, { week: weekNumber }),
    relativePath: `${typeDirName}/${year}/${startDateIso}.md`,
    weekNumber
  }
}
