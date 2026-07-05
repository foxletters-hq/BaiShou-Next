/** 跨 DiaryScreen 重挂载保留列表滚动位置 */
let lastKnownDiaryListScrollY = 0

export function saveDiaryListScrollY(offsetY: number): void {
  if (offsetY >= 0) {
    lastKnownDiaryListScrollY = offsetY
  }
}

export function readDiaryListScrollY(): number {
  return lastKnownDiaryListScrollY
}
