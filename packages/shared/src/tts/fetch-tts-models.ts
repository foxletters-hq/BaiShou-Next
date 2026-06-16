const CLONE_TTS_VOICE_ARRAY_KEYS = ['voices', 'data', 'items', 'list'] as const
const CLONE_TTS_VOICE_ID_KEYS = [
  'alias',
  'name',
  'id',
  'voice',
  'voiceName',
  'path',
  'ref_audio',
  'refAudioPath'
] as const

const TTS_FETCH_TIMEOUT_MS = 30_000

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TTS_FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function extractCloneTtsVoiceArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []

  const record = data as Record<string, unknown>
  for (const key of CLONE_TTS_VOICE_ARRAY_KEYS) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function readCloneTtsVoiceField(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

function extractCloneTtsVoiceId(item: unknown, index: number): string | null {
  if (typeof item === 'string') {
    return readCloneTtsVoiceField(item)
  }
  if (!item || typeof item !== 'object') return null

  const record = item as Record<string, unknown>
  for (const key of CLONE_TTS_VOICE_ID_KEYS) {
    const id = readCloneTtsVoiceField(record[key])
    if (id) return id
  }
  return `voice-${index + 1}`
}

function disambiguateCloneTtsVoiceId(baseId: string, seen: Map<string, number>): string {
  const count = seen.get(baseId) ?? 0
  seen.set(baseId, count + 1)
  return count === 0 ? baseId : `${baseId} (${count + 1})`
}

/** 解析 CloneTTS /api/voices 响应，兼容顶层数组与 { voices } 等包装格式 */
export function parseCloneTtsVoiceList(data: unknown): string[] {
  const items = extractCloneTtsVoiceArray(data)
  const ids: string[] = []
  const seen = new Map<string, number>()

  for (let index = 0; index < items.length; index++) {
    const baseId = extractCloneTtsVoiceId(items[index], index)
    if (!baseId) continue
    ids.push(disambiguateCloneTtsVoiceId(baseId, seen))
  }

  return ids
}

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
      const response = await fetchWithTimeout(url.toString(), { headers })
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
