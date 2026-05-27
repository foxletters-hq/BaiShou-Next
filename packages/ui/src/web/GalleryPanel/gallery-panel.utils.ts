import type { SummaryItem } from '../../shared/gallery-panel/gallery-panel.types'
import {
  TYPE_I18N_MAP,
  SUMMARY_TABS,
  getWeekNumber,
  getPreview
} from '../../shared/gallery-panel/gallery-panel.utils'

export { TYPE_I18N_MAP, SUMMARY_TABS, getWeekNumber, getPreview }
export type { SummaryTab } from '../../shared/gallery-panel/gallery-panel.utils'

export const formatDateRange = (
  s: SummaryItem,
  language: string,
  t: (key: string, fallback: string) => string
): string => {
  if (!s.startDate) return ''
  const start = new Date(s.startDate)

  if (s.type === 'weekly') {
    return start.toLocaleDateString(language, { month: 'long', day: 'numeric' })
  }
  if (!s.endDate) return ''
  if (s.type === 'monthly') {
    return start.toLocaleDateString(language, { year: 'numeric', month: 'long' })
  }
  if (s.type === 'quarterly') {
    const q = Math.ceil((start.getMonth() + 1) / 3)
    return t('summary.missing_label_quarterly', '$year Q$q')
      .replace('$year', String(start.getFullYear()))
      .replace('$q', String(q))
  }
  if (s.type === 'yearly') {
    return t('summary.missing_label_yearly', 'Year $year').replace(
      '$year',
      String(start.getFullYear())
    )
  }
  return ''
}

export const getTitle = (s: SummaryItem, t: (key: string, fallback: string) => string): string => {
  if (!s.startDate) return t('gallery.summary', 'Summary')
  const dateObj = new Date(s.startDate)

  if (s.type === 'weekly') {
    const weekNum = getWeekNumber(dateObj)
    const year = dateObj.getFullYear()
    return t('summary.missing_label_weekly', 'Week $week, $year')
      .replace('$year', String(year))
      .replace('$week', String(weekNum))
  }
  if (s.type === 'monthly') {
    const month = dateObj.getMonth() + 1
    const year = dateObj.getFullYear()
    return t('summary.title_monthly', 'Monthly Report ($year-$month)')
      .replace('$year', String(year))
      .replace('$month', String(month))
  }
  if (s.type === 'quarterly') {
    const q = Math.ceil((dateObj.getMonth() + 1) / 3)
    const year = dateObj.getFullYear()
    return t('summary.missing_label_quarterly', '$year Q$q')
      .replace('$year', String(year))
      .replace('$q', String(q))
  }
  if (s.type === 'yearly') {
    const year = dateObj.getFullYear()
    return t('summary.missing_label_yearly', 'Year $year').replace('$year', String(year))
  }
  return t('gallery.summary', 'Summary')
}
