/**
 * 同步流量护栏：移动数据下是否弹出蜂窝流量警告。
 * Wi-Fi / unknown 不提示（宁可漏报不可误报）；桌面 isMetered 恒 false。
 *
 * S1 是 UI 护栏（确认弹窗），不是传输硬拦截——用户仍可选择继续同步。
 */

export const DEFAULT_SYNC_TRAFFIC_PROMPT_ENABLED = true
/** 默认阈值 50 MB */
export const DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB = 50
export const DEFAULT_SYNC_TRAFFIC_THRESHOLD_BYTES = DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB * 1024 * 1024

export function syncTrafficThresholdMbToBytes(thresholdMb: number): number {
  const mb = Number.isFinite(thresholdMb)
    ? Math.max(0, thresholdMb)
    : DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB
  return Math.floor(mb * 1024 * 1024)
}

export function shouldWarnCellularSyncTraffic(input: {
  enabled: boolean
  thresholdBytes: number
  isMetered: boolean
  totalUploadBytes: number
  totalDownloadBytes: number
}): boolean {
  if (!input.enabled || !input.isMetered) return false
  const threshold =
    Number.isFinite(input.thresholdBytes) && input.thresholdBytes >= 0
      ? input.thresholdBytes
      : DEFAULT_SYNC_TRAFFIC_THRESHOLD_BYTES
  const total =
    Math.max(0, input.totalUploadBytes || 0) + Math.max(0, input.totalDownloadBytes || 0)
  // 文案为「超过」阈值才提示，故用严格大于（恰好等于不警告）
  return total > threshold
}
