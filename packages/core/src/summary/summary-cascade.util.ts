/** 带日期范围的总结条目（季报级联用） */
export type SummaryDateRange = {
  endDate: Date | string
}

/**
 * 参与月报级联折叠的季报列表。
 * 最近一份季报（按 endDate）不参与覆盖，以便当季月报在复制共同回忆时仍可展示。
 */
export function quarterlySummariesForMonthCascade<T extends SummaryDateRange>(qList: T[]): T[] {
  if (qList.length <= 1) return []
  const sorted = [...qList].sort(
    (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
  )
  return sorted.slice(1)
}
