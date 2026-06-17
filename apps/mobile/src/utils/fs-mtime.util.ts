/** expo-file-system/next 返回毫秒；旧版 legacy API 与部分路径为秒 */
export function normalizeMtimeToMs(modificationTime: number): number {
  return modificationTime < 1e12 ? modificationTime * 1000 : modificationTime
}
