/** 月份 i18n 键后缀（对应 diary.month_*） */
export const MONTH_I18N_KEYS = [
  'month_jan',
  'month_feb',
  'month_mar',
  'month_apr',
  'month_may',
  'month_jun',
  'month_jul',
  'month_aug',
  'month_sep',
  'month_oct',
  'month_nov',
  'month_dec'
] as const

/** 从 2000 年到当前年份 +30 年 */
export function getPickerYearRange(): number[] {
  const currentYear = new Date().getFullYear()
  const startYear = 2000
  const endYear = currentYear + 30
  const length = endYear - startYear + 1
  return Array.from({ length }, (_, i) => startYear + i)
}
