/** 拉取 OpenAI 兼容 /models 列表，支持分页 */
export async function fetchOpenAiCompatibleModelIds(
  baseUrl: string,
  apiKey?: string
): Promise<string[]> {
  const trimmedBase = baseUrl.trim().replace(/\/$/, '')
  if (!trimmedBase) {
    return ['tts-1', 'tts-1-hd']
  }

  const headers: Record<string, string> = {}
  const trimmedKey = apiKey?.trim()
  if (trimmedKey) {
    headers.Authorization = `Bearer ${trimmedKey}`
  }

  const allIds: string[] = []
  let after: string | undefined

  try {
    for (let page = 0; page < 20; page++) {
      const url = new URL(`${trimmedBase}/models`)
      if (after) {
        url.searchParams.set('after', after)
      }
      const response = await fetch(url.toString(), { headers })
      if (!response.ok) break

      const data = (await response.json()) as {
        data?: Array<{ id?: string }>
        has_more?: boolean
        last_id?: string
      }
      if (!data?.data || !Array.isArray(data.data)) break

      for (const item of data.data) {
        if (item.id) allIds.push(item.id)
      }

      if (!data.has_more || !data.last_id) break
      after = data.last_id
    }
  } catch {
    return allIds.length > 0 ? allIds : ['tts-1', 'tts-1-hd']
  }

  if (allIds.length === 0) {
    return ['tts-1', 'tts-1-hd']
  }

  const ttsModels = allIds.filter((id) => id.toLowerCase().includes('tts'))
  return ttsModels.length > 0 ? ttsModels : allIds
}
