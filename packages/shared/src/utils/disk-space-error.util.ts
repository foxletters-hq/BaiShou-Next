/** 判断是否为磁盘空间不足导致的 I/O 错误 */
export function isDiskFullError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('enospc') || normalized.includes('no space left on device')
}
