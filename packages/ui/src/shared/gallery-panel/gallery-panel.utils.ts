import type { SummaryItem } from './gallery-panel.types'

export const SUMMARY_TABS = ['weekly', 'monthly', 'quarterly', 'yearly'] as const
export type SummaryTab = (typeof SUMMARY_TABS)[number]

export const TYPE_I18N_MAP: Record<string, string> = {
  weekly: 'summary.stats_week',
  monthly: 'summary.stats_month',
  quarterly: 'summary.stats_quarter',
  yearly: 'summary.stats_year'
}

export const NUM_COLUMNS = 3

export const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - firstDayOfYear.getTime()
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
}

export const formatDateRange = (s: SummaryItem): string => {
  if (!s.startDate || !s.endDate) return ''
  const start = new Date(s.startDate)
  const end = new Date(s.endDate)

  if (s.type === 'weekly') {
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
  }
  if (s.type === 'monthly') {
    return `${start.getFullYear()}年${start.getMonth() + 1}月`
  }
  if (s.type === 'quarterly') {
    const q = Math.ceil((start.getMonth() + 1) / 3)
    return `${start.getFullYear()}年 Q${q}`
  }
  if (s.type === 'yearly') {
    return `${start.getFullYear()}年`
  }
  return ''
}

export const getTitle = (
  s: SummaryItem,
  t: (key: string, fallback: string) => string
): string => {
  if (!s.startDate) return t('gallery.summary', '总结')
  const dateObj = new Date(s.startDate)

  if (s.type === 'weekly') {
    const weekNum = getWeekNumber(dateObj)
    return t('summary.card_week_title', `第 ${weekNum} 周`).replace('$week', String(weekNum))
  }
  if (s.type === 'monthly') {
    const month = dateObj.getMonth() + 1
    return t('summary.card_month_title', `${month}月`).replace('$month', String(month))
  }
  if (s.type === 'quarterly') {
    const q = Math.ceil((dateObj.getMonth() + 1) / 3)
    const year = dateObj.getFullYear()
    return t('summary.missing_label_quarterly', `${year}年Q${q}`)
      .replace('$year', String(year))
      .replace('$q', String(q))
  }
  if (s.type === 'yearly') {
    const year = dateObj.getFullYear()
    return t('summary.card_year_suffix', `${year}年`).replace('$year', String(year))
  }
  return t('gallery.summary', '总结')
}

export const getPreview = (content: string): string => {
  if (!content) return ''
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      return trimmed.replace(/[*_~`]/g, '').substring(0, 80)
    }
  }
  return ''
}
