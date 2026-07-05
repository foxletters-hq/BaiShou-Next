import { isTtsProviderId, resolveTtsProviderBaseUrl } from './tts-defaults'
import { MIMO_TTS_DEFAULT_MODELS } from './mimo-tts.util'
import { MINIMAX_TTS_DEFAULT_MODELS } from './minimax-tts.util'
import { buildMimoTtsAuthHeaders } from './tts-http'

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
const GPT_SOVITS_GPT_DROPDOWN_ID = 5
const GPT_SOVITS_SOVITS_DROPDOWN_ID = 6

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
  apiKey?: string,
  headersOverride?: Record<string, string>
): Promise<string[]> {
  const trimmedBase = baseUrl.trim().replace(/\/$/, '')
  if (!trimmedBase) {
    return ['tts-1', 'tts-1-hd']
  }

  const headers: Record<string, string> = headersOverride ? { ...headersOverride } : {}
  if (!headersOverride) {
    const trimmedKey = apiKey?.trim()
    if (trimmedKey) {
      headers.Authorization = `Bearer ${trimmedKey}`
    }
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

type GradioConfigComponent = {
  id?: number
  props?: {
    value?: unknown
    choices?: unknown[]
  }
}

function normalizeGradioChoiceLabel(choice: unknown): string | null {
  if (typeof choice === 'string') {
    const trimmed = choice.trim()
    return trimmed || null
  }
  if (!Array.isArray(choice) || choice.length === 0) {
    return null
  }

  const first = choice[0]
  const second = choice[1]
  if (typeof second === 'string' && second.trim()) {
    return second.trim()
  }
  if (typeof first === 'string' && first.trim()) {
    return first.trim()
  }
  return null
}

function extractGptSovitsChoices(component: GradioConfigComponent | undefined): string[] {
  if (!component?.props) {
    return []
  }

  const values = new Set<string>()
  const currentValue = normalizeGradioChoiceLabel(component.props.value)
  if (currentValue) {
    values.add(currentValue)
  }

  const rawChoices = Array.isArray(component.props.choices) ? component.props.choices : []
  for (const choice of rawChoices) {
    const normalized = normalizeGradioChoiceLabel(choice)
    if (normalized) {
      values.add(normalized)
    }
  }

  return Array.from(values)
}

export async function fetchGptSovitsModelIds(baseUrl: string): Promise<string[]> {
  const trimmedBase = baseUrl.trim().replace(/\/$/, '')
  if (!trimmedBase) {
    return ['default']
  }

  const response = await fetchWithTimeout(`${trimmedBase}/config`)
  if (!response.ok) {
    return ['default']
  }

  const data = (await response.json()) as { components?: GradioConfigComponent[] }
  const components = Array.isArray(data?.components) ? data.components : []
  const gptComponent = components.find((component) => component.id === GPT_SOVITS_GPT_DROPDOWN_ID)
  const sovitsComponent = components.find(
    (component) => component.id === GPT_SOVITS_SOVITS_DROPDOWN_ID
  )

  const modelIds = extractGptSovitsChoices(sovitsComponent)
  const fallbackIds = extractGptSovitsChoices(gptComponent)
  const combined = modelIds.length > 0 ? modelIds : fallbackIds

  return combined.length > 0 ? combined : ['default']
}

export async function fetchMimoTtsModelIds(baseUrl: string, apiKey?: string): Promise<string[]> {
  const trimmedBase = resolveTtsProviderBaseUrl('mimo-tts', baseUrl)
  const headers = buildMimoTtsAuthHeaders(apiKey)
  try {
    const models = await fetchOpenAiCompatibleModelIds(trimmedBase, apiKey, headers)
    const mimoTts = models.filter(
      (id) => id.toLowerCase().includes('mimo') && id.toLowerCase().includes('tts')
    )
    if (mimoTts.length > 0) {
      return mimoTts
    }
  } catch {
    // fall through to built-in defaults
  }
  return [...MIMO_TTS_DEFAULT_MODELS]
}

export function fetchMinimaxTtsModelIds(): string[] {
  return [...MINIMAX_TTS_DEFAULT_MODELS]
}

async function fetchCloneTtsVoiceIds(baseUrl: string): Promise<string[]> {
  const trimmedUrl = baseUrl.trim().replace(/\/$/, '')
  if (!trimmedUrl) {
    return []
  }

  const response = await fetchWithTimeout(`${trimmedUrl}/api/voices`)
  if (!response.ok) {
    return []
  }
  const data = await response.json()
  return parseCloneTtsVoiceList(data)
}

export class TtsFetchModelsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TtsFetchModelsError'
  }
}

/**
 * 统一的 TTS 模型/音色列表拉取入口（桌面与移动端共用）
 */
export async function fetchTtsProviderModels(
  providerId: string,
  apiKey: string,
  baseUrl: string
): Promise<string[]> {
  if (!isTtsProviderId(providerId)) {
    throw new TtsFetchModelsError(`Unknown TTS provider: ${providerId}`)
  }

  const trimmedKey = apiKey.trim()

  if (providerId === 'clone-tts') {
    try {
      return await fetchCloneTtsVoiceIds(baseUrl)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TtsFetchModelsError(
          `请求超时（${TTS_FETCH_TIMEOUT_MS / 1000}s），请检查 CloneTTS 服务地址是否可达`
        )
      }
      return []
    }
  }

  if (providerId === 'openai-tts') {
    try {
      return await fetchOpenAiCompatibleModelIds(baseUrl, trimmedKey)
    } catch {
      return ['tts-1', 'tts-1-hd']
    }
  }

  if (providerId === 'mimo-tts') {
    return fetchMimoTtsModelIds(baseUrl, trimmedKey)
  }

  if (providerId === 'minimax-tts') {
    return fetchMinimaxTtsModelIds()
  }

  if (providerId === 'gpt-sovits') {
    try {
      const resolvedBase = resolveTtsProviderBaseUrl('gpt-sovits', baseUrl)
      return await fetchGptSovitsModelIds(resolvedBase)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TtsFetchModelsError(
          `请求超时（${TTS_FETCH_TIMEOUT_MS / 1000}s），请检查 GPT-SoVITS 服务地址是否可达`
        )
      }
      return ['default']
    }
  }

  return []
}
