/** 批量嵌入时优先处理最早日记（日期从旧到新） */
export function sortDiariesByDateAsc<T extends { date: Date }>(diaries: T[]): T[] {
  return [...diaries].sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** 按日记日期从新到旧排序（展示等场景） */
export function sortDiariesByDateDesc<T extends { date: Date }>(diaries: T[]): T[] {
  return [...diaries].sort((a, b) => b.date.getTime() - a.date.getTime())
}
