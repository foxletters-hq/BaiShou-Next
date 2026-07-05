/** 同一轮 Agent 任务内追踪已读取的日记日期，供 diary_edit 前置校验。 */
export interface DiaryReadGuard {
  markRead(dates: readonly string[]): void
  hasRead(date: string): boolean
}

export function createDiaryReadGuard(): DiaryReadGuard {
  const readDates = new Set<string>()

  return {
    markRead(dates: readonly string[]) {
      for (const date of dates) {
        if (date) readDates.add(date)
      }
    },
    hasRead(date: string) {
      return readDates.has(date)
    }
  }
}
