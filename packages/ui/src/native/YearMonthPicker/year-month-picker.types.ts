export interface YearMonthPickerProps {
  /** 当前选中的月份日期（Date对象，月份为该月1号） */
  selectedMonth: Date | null
  /** 选择变化回调 */
  onChange: (date: Date | null) => void
  /** 占位文本 */
  titlePlaceholder?: string
}
