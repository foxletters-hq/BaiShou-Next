/** 未持久化偏好时，联网搜索默认开启 */
export const DEFAULT_WEB_SEARCH_MODE_ENABLED = true

/**
 * 解析对话是否启用联网搜索：显式参数优先，未设置时读持久化偏好，仍无则默认开启。
 */
export function resolveWebSearchEnabled(
  explicit?: boolean | null,
  storedPreference?: boolean | null
): boolean {
  if (explicit === true) return true
  if (explicit === false) return false
  if (storedPreference === undefined || storedPreference === null) {
    return DEFAULT_WEB_SEARCH_MODE_ENABLED
  }
  return storedPreference
}
