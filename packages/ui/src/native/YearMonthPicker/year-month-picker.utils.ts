export const MONTH_NAMES = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月'
] as const

/** 从 2000 年到当前年份 +30 年 */
export function getPickerYearRange(): number[] {
  const currentYear = new Date().getFullYear()
  const startYear = 2000
  const endYear = currentYear + 30
  const length = endYear - startYear + 1
  return Array.from({ length }, (_, i) => startYear + i)
}
