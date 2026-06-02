export type DateSelectField = 'year' | 'month' | 'day'

export interface DateSelectProps {
  value: Date
  onChange: (date: Date) => void
  /** 要展示的滚轮，按顺序排列。例如 ['year','month'] 仅年月 */
  fields?: DateSelectField[]
  /** 弹窗打开时用于重置滚轮位置的 key */
  scrollKey?: string
  minDate?: Date
  maxDate?: Date
}
