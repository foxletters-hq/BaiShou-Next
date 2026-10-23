/** DeepSeek 官方供应商 id。第三方网关即使代理同名模型也不套峰谷。 */
export const DEEPSEEK_OFFICIAL_PROVIDER_ID = 'deepseek'

/**
 * 公开价目对 DeepSeek 更接近空闲价；高峰按官方规则为 2 倍。
 * 高峰：北京时间周一至周五 9:00–12:00、14:00–18:00（12:00 / 18:00 起算空闲）。
 */
export const DEEPSEEK_PEAK_PRICE_MULTIPLIER = 2

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

export function isDeepSeekOfficialProvider(providerId: string): boolean {
  return providerId.trim().toLowerCase() === DEEPSEEK_OFFICIAL_PROVIDER_ID
}

export function isDeepSeekPeakHour(at: Date): boolean {
  const beijing = new Date(at.getTime() + BEIJING_OFFSET_MS)
  const weekday = beijing.getUTCDay()
  if (weekday === 0 || weekday === 6) return false
  const hour = beijing.getUTCHours()
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

export function deepSeekPeakCostMultiplier(providerId: string, at: Date = new Date()): number {
  if (!isDeepSeekOfficialProvider(providerId)) return 1
  return isDeepSeekPeakHour(at) ? DEEPSEEK_PEAK_PRICE_MULTIPLIER : 1
}

export function applyDeepSeekPeakCost(
  providerId: string,
  usd: number,
  at: Date = new Date()
): number {
  return usd * deepSeekPeakCostMultiplier(providerId, at)
}
