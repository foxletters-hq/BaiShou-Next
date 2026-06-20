import type { TtsSettings } from '../types/settings.types'
import { isMimoVoiceCloneModel, resolveMimoTtsSynthesisModelId } from './mimo-tts.util'

export const TTS_PROVIDER_IDS = ['openai-tts', 'mimo-tts', 'clone-tts', 'gpt-sovits'] as const

export type TtsProviderId = (typeof TTS_PROVIDER_IDS)[number]

export const TTS_DEFAULT_BASE_URLS: Record<TtsProviderId, string> = {
  'openai-tts': 'https://api.openai.com/v1',
  'mimo-tts': 'https://api.xiaomimimo.com/v1',
  'clone-tts': 'http://127.0.0.1:8080',
  'gpt-sovits': 'http://127.0.0.1:9872'
}

export const TTS_DEFAULT_MODEL_IDS: Record<TtsProviderId, string> = {
  'openai-tts': 'tts-1',
  'mimo-tts': 'mimo-v2.5-tts',
  'clone-tts': 'default',
  'gpt-sovits': 'default'
}

export const TTS_DEFAULT_VOICES: Record<TtsProviderId, string> = {
  'openai-tts': 'alloy',
  'mimo-tts': '冰糖',
  'clone-tts': 'default',
  'gpt-sovits': 'default'
}

export interface TtsProviderLocalState {
  baseUrl: string
  apiKey: string
  modelId: string
  voice: string
  speed: number
  responseFormat: string
  availableModels: string[]
  refAudioPath?: string
  refAudioBase64?: string
  promptText?: string
  promptLang?: string
  textLang?: string
  stream?: boolean
}

export interface TtsSettingsInitialConfig {
  id: string
  baseUrl: string
  apiKey: string
  modelId: string
  voice: string
  speed: number
  responseFormat: string
  refAudioPath: string
  refAudioBase64: string
  promptText: string
  promptLang: string
  textLang: string
  stream?: boolean
}

export function isTtsProviderId(id: string): id is TtsProviderId {
  return (TTS_PROVIDER_IDS as readonly string[]).includes(id)
}

export function getTtsDefaultBaseUrl(providerId: string): string {
  return isTtsProviderId(providerId)
    ? TTS_DEFAULT_BASE_URLS[providerId]
    : TTS_DEFAULT_BASE_URLS['openai-tts']
}

export function resolveTtsProviderBaseUrl(providerId: string, baseUrl?: string | null): string {
  const trimmed = (baseUrl ?? '').trim()
  if (trimmed) {
    return trimmed.replace(/\/$/, '')
  }
  return getTtsDefaultBaseUrl(providerId).replace(/\/$/, '')
}

export function getTtsDefaultResponseFormat(providerId: string): string {
  return providerId === 'mimo-tts' || providerId === 'gpt-sovits' ? 'wav' : 'mp3'
}

export function getTtsInitialConfigs(): Record<TtsProviderId, TtsProviderLocalState> {
  return {
    'openai-tts': {
      baseUrl: TTS_DEFAULT_BASE_URLS['openai-tts'],
      apiKey: '',
      modelId: TTS_DEFAULT_MODEL_IDS['openai-tts'],
      voice: TTS_DEFAULT_VOICES['openai-tts'],
      speed: 1.0,
      responseFormat: 'mp3',
      availableModels: []
    },
    'mimo-tts': {
      baseUrl: TTS_DEFAULT_BASE_URLS['mimo-tts'],
      apiKey: '',
      modelId: TTS_DEFAULT_MODEL_IDS['mimo-tts'],
      voice: TTS_DEFAULT_VOICES['mimo-tts'],
      speed: 1.0,
      responseFormat: 'wav',
      availableModels: []
    },
    'clone-tts': {
      baseUrl: TTS_DEFAULT_BASE_URLS['clone-tts'],
      apiKey: '',
      modelId: TTS_DEFAULT_MODEL_IDS['clone-tts'],
      voice: TTS_DEFAULT_VOICES['clone-tts'],
      speed: 1.0,
      responseFormat: 'mp3',
      availableModels: []
    },
    'gpt-sovits': {
      baseUrl: TTS_DEFAULT_BASE_URLS['gpt-sovits'],
      apiKey: '',
      modelId: TTS_DEFAULT_MODEL_IDS['gpt-sovits'],
      voice: TTS_DEFAULT_VOICES['gpt-sovits'],
      speed: 1.0,
      responseFormat: 'wav',
      availableModels: [],
      refAudioPath: '',
      promptText: '',
      promptLang: 'zh',
      textLang: 'zh'
    }
  }
}

function mergeTtsProviderEntry(
  defaults: TtsProviderLocalState,
  partial?: Partial<TtsProviderLocalState>
): TtsProviderLocalState {
  if (!partial) return defaults
  return {
    ...defaults,
    ...partial,
    baseUrl: partial.baseUrl?.trim() ? partial.baseUrl : defaults.baseUrl,
    apiKey: partial.apiKey !== undefined ? partial.apiKey : defaults.apiKey,
    modelId: partial.modelId?.trim() ? partial.modelId : defaults.modelId,
    voice:
      partial.voice !== undefined
        ? partial.voice.trim() ||
          (isMimoVoiceCloneModel(partial.modelId?.trim() || defaults.modelId) ? '' : defaults.voice)
        : defaults.voice,
    speed: partial.speed ?? defaults.speed,
    responseFormat: partial.responseFormat?.trim()
      ? partial.responseFormat
      : defaults.responseFormat,
    availableModels:
      partial.availableModels && partial.availableModels.length > 0
        ? partial.availableModels
        : defaults.availableModels,
    refAudioPath: partial.refAudioPath ?? defaults.refAudioPath,
    refAudioBase64: partial.refAudioBase64 ?? defaults.refAudioBase64,
    promptText: partial.promptText ?? defaults.promptText,
    promptLang: partial.promptLang ?? defaults.promptLang,
    textLang: partial.textLang ?? defaults.textLang,
    stream: partial.stream ?? defaults.stream
  }
}

export function mergeTtsPersistedConfigs(
  persisted: Record<string, Partial<TtsProviderLocalState>> | null | undefined
): Record<TtsProviderId, TtsProviderLocalState> {
  const defaults = getTtsInitialConfigs()
  return {
    'openai-tts': mergeTtsProviderEntry(defaults['openai-tts'], persisted?.['openai-tts']),
    'mimo-tts': mergeTtsProviderEntry(defaults['mimo-tts'], persisted?.['mimo-tts']),
    'clone-tts': mergeTtsProviderEntry(defaults['clone-tts'], persisted?.['clone-tts']),
    'gpt-sovits': mergeTtsProviderEntry(defaults['gpt-sovits'], persisted?.['gpt-sovits'])
  }
}

/** 从 global_models 合并当前供应商的合成参数（globalTtsSettings + 各供应商独立配置） */
export function resolveTtsSynthesisSettings(
  globalModels: TtsGlobalModelsSnapshot | null | undefined,
  providerId: string
): TtsSettings & { modelId?: string } {
  const globalSettings = globalModels?.globalTtsSettings ?? {}
  const providerEntry = globalModels?.globalTtsProviderConfigs?.[providerId] ?? {}
  const isActiveGlobal = globalModels?.globalTtsProviderId === providerId

  const pickString = (...candidates: Array<string | undefined>): string => {
    for (const value of candidates) {
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value)
      }
    }
    return ''
  }

  const refAudioPath = pickString(globalSettings.refAudioPath, providerEntry.refAudioPath)
  const refAudioBase64 = pickString(globalSettings.refAudioBase64, providerEntry.refAudioBase64)
  const candidateModelId = pickString(
    isActiveGlobal ? globalModels?.globalTtsModelId : undefined,
    providerEntry.modelId
  )

  return {
    modelId:
      providerId === 'mimo-tts'
        ? resolveMimoTtsSynthesisModelId(candidateModelId, refAudioPath, refAudioBase64)
        : candidateModelId || undefined,
    voice: pickString(globalSettings.voice, providerEntry.voice),
    speed: globalSettings.speed ?? providerEntry.speed ?? 1,
    responseFormat: pickString(globalSettings.responseFormat, providerEntry.responseFormat),
    refAudioPath,
    refAudioBase64,
    promptText: pickString(globalSettings.promptText, providerEntry.promptText),
    promptLang: pickString(globalSettings.promptLang, providerEntry.promptLang, 'zh'),
    textLang: pickString(globalSettings.textLang, providerEntry.textLang, 'zh'),
    stream: globalSettings.stream ?? providerEntry.stream
  }
}

/** 从 global_models.globalTtsProviderConfigs 读取 TTS 连接信息（与 ai_providers 无关） */
export function resolveTtsProviderCredentials(
  providerId: string,
  globalTtsProviderConfigs?: Record<string, { baseUrl?: string; apiKey?: string }>
): { baseUrl?: string; apiKey?: string } {
  return globalTtsProviderConfigs?.[providerId] ?? {}
}

export interface TtsGlobalModelsSnapshot {
  globalTtsProviderId?: string
  globalTtsModelId?: string
  globalTtsSettings?: Partial<TtsSettings>
  globalTtsProviderConfigs?: Record<string, Partial<TtsProviderLocalState>>
}

/** 从 global_models 还原各 TTS 供应商的完整表单状态（不依赖 localStorage） */
export function buildTtsProviderStatesFromGlobal(
  globalModels?: TtsGlobalModelsSnapshot | null
): Record<TtsProviderId, TtsProviderLocalState> {
  const result = getTtsInitialConfigs()
  if (!globalModels) return result

  const rawProviderId = globalModels.globalTtsProviderId || ''
  const savedProviderId: TtsProviderId = isTtsProviderId(rawProviderId)
    ? rawProviderId
    : 'openai-tts'
  const ttsSettings = globalModels.globalTtsSettings || {}
  const providerConfigs = globalModels.globalTtsProviderConfigs || {}

  for (const id of TTS_PROVIDER_IDS) {
    const saved = providerConfigs[id]
    if (saved) {
      result[id] = mergeTtsProviderEntry(result[id], saved)
    }
  }

  result[savedProviderId] = mergeTtsProviderEntry(result[savedProviderId], {
    modelId: globalModels.globalTtsModelId,
    voice: ttsSettings.voice,
    speed: ttsSettings.speed,
    responseFormat: ttsSettings.responseFormat,
    refAudioPath: ttsSettings.refAudioPath,
    refAudioBase64: ttsSettings.refAudioBase64,
    promptText: ttsSettings.promptText,
    promptLang: ttsSettings.promptLang,
    textLang: ttsSettings.textLang,
    stream: ttsSettings.stream,
    baseUrl: providerConfigs[savedProviderId]?.baseUrl,
    apiKey: providerConfigs[savedProviderId]?.apiKey,
    availableModels: providerConfigs[savedProviderId]?.availableModels
  })

  return result
}

export function buildTtsProviderConnectionEntry(
  state: TtsProviderLocalState
): NonNullable<TtsGlobalModelsSnapshot['globalTtsProviderConfigs']>[string] {
  return {
    baseUrl: state.baseUrl,
    apiKey: state.apiKey,
    availableModels: state.availableModels,
    modelId: state.modelId,
    voice: state.voice,
    speed: state.speed,
    responseFormat: state.responseFormat,
    refAudioPath: state.refAudioPath,
    refAudioBase64: state.refAudioBase64,
    promptText: state.promptText,
    promptLang: state.promptLang,
    textLang: state.textLang,
    stream: state.stream
  }
}

export function buildTtsSettingsInitialConfig(params: {
  activeProviderId: string
  globalTtsProviderId?: string
  globalTtsModelId?: string
  globalTtsSettings?: Partial<TtsSettings>
  globalTtsProviderConfigs?: Record<string, { baseUrl?: string; apiKey?: string }>
  persisted?: Record<TtsProviderId, TtsProviderLocalState>
}): TtsSettingsInitialConfig {
  const {
    activeProviderId,
    globalTtsProviderId,
    globalTtsModelId,
    globalTtsSettings,
    globalTtsProviderConfigs,
    persisted
  } = params

  const activeId = isTtsProviderId(activeProviderId) ? activeProviderId : 'openai-tts'
  const savedProviderId = isTtsProviderId(globalTtsProviderId || '')
    ? globalTtsProviderId!
    : 'openai-tts'
  const isActiveGlobal = activeId === savedProviderId
  const local = persisted?.[activeId]
  const ttsSettings = globalTtsSettings || {}
  const savedConnection = globalTtsProviderConfigs?.[activeId]
  const resolvedBaseUrl =
    savedConnection?.baseUrl?.trim() || local?.baseUrl?.trim() || getTtsDefaultBaseUrl(activeId)
  const resolvedApiKey = savedConnection?.apiKey ?? local?.apiKey ?? ''

  return {
    id: activeId,
    baseUrl: resolvedBaseUrl,
    apiKey: resolvedApiKey,
    modelId:
      (isActiveGlobal ? globalTtsModelId : undefined) ||
      local?.modelId ||
      TTS_DEFAULT_MODEL_IDS[activeId],
    voice:
      (isActiveGlobal ? ttsSettings.voice : undefined) ||
      local?.voice ||
      TTS_DEFAULT_VOICES[activeId],
    speed: (isActiveGlobal ? ttsSettings.speed : undefined) ?? local?.speed ?? 1,
    responseFormat:
      (isActiveGlobal ? ttsSettings.responseFormat : undefined) ||
      local?.responseFormat ||
      getTtsDefaultResponseFormat(activeId),
    refAudioPath:
      (isActiveGlobal ? ttsSettings.refAudioPath : undefined) || local?.refAudioPath || '',
    refAudioBase64:
      (isActiveGlobal ? ttsSettings.refAudioBase64 : undefined) || local?.refAudioBase64 || '',
    promptText: (isActiveGlobal ? ttsSettings.promptText : undefined) || local?.promptText || '',
    promptLang: (isActiveGlobal ? ttsSettings.promptLang : undefined) || local?.promptLang || 'zh',
    textLang: (isActiveGlobal ? ttsSettings.textLang : undefined) || local?.textLang || 'zh',
    stream: (isActiveGlobal ? ttsSettings.stream : undefined) ?? local?.stream
  }
}
