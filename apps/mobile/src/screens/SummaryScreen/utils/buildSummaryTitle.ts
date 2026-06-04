import type { TFunction } from 'i18next'

export interface SummaryTitleInput {
  type: string
  startDate: string
}

const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const diff = date.getTime() - firstDayOfYear.getTime()
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
}

/** 与桌面 SummaryGalleryView 一致的总结标题 */
export function buildSummaryTitle(summary: SummaryTitleInput, t: TFunction): string {
  const start = new Date(summary.startDate)
  if (summary.type === 'weekly') {
    return t('summary.missing_label_weekly')
      .replace('$year', String(start.getFullYear()))
      .replace('$week', String(getWeekNumber(start)))
  }
  if (summary.type === 'monthly') {
    return t('summary.title_monthly')
      .replace('$year', String(start.getFullYear()))
      .replace('$month', String(start.getMonth() + 1))
  }
  if (summary.type === 'quarterly') {
    return t('summary.missing_label_quarterly')
      .replace('$year', String(start.getFullYear()))
      .replace('$q', String(Math.ceil((start.getMonth() + 1) / 3)))
  }
  return t('summary.missing_label_yearly').replace('$year', String(start.getFullYear()))
}
