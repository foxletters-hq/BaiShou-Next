/** Build fetch headers; omit Authorization when API key is empty (local / open gateways). */
export function buildTtsAuthHeaders(
  apiKey: string | undefined,
  extra: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  const key = apiKey?.trim()
  if (key) {
    headers.Authorization = `Bearer ${key}`
  }
  return headers
}

/** MiMo 官方 TTS 文档要求使用 api-key 请求头 */
export function buildMimoTtsAuthHeaders(
  apiKey: string | undefined,
  extra: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  const key = apiKey?.trim()
  if (key) {
    headers['api-key'] = key
  }
  return headers
}
