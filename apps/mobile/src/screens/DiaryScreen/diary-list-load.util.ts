/** 翻页/换月/改筛选时必须阻塞刷新；Tab 返回等场景可静默刷新 */
export function shouldDiaryListLoadSilently(
  hasCachedRows: boolean,
  browseChanged: boolean,
  explicitSilent?: boolean
): boolean {
  if (explicitSilent != null) return explicitSilent
  return hasCachedRows && !browseChanged
}
