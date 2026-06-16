import { AIProviderRegistry, type IAIProvider } from '@baishou/ai'
import {
  AIProviderConfig,
  ProviderType,
  fetchOpenAiCompatibleModelIds,
  parseCloneTtsVoiceList,
  resolveProviderBaseUrl,
  resolveTtsProviderBaseUrl
} from '@baishou/shared'

/** 与桌面 settings:fetch-models 中 TTS 相关分支保持一致 */
export async function fetchTtsProviderModels(
  providerId: string,
  apiKey: string,
  baseUrl: string
): Promise<string[]> {
  const trimmedKey = apiKey.trim()
  const trimmedUrl =
    providerId === 'mimo-tts'
      ? resolveTtsProviderBaseUrl(providerId, baseUrl)
      : baseUrl.trim().replace(/\/$/, '')

  if (providerId === 'clone-tts') {
    if (!trimmedUrl) return []
    try {
      const response = await fetch(`${trimmedUrl}/api/voices`)
      if (response.ok) {
        const data = await response.json()
        return parseCloneTtsVoiceList(data)
      }
    } catch {
      return []
    }
    return []
  }

  if (providerId === 'openai-tts') {
    return fetchOpenAiCompatibleModelIds(trimmedUrl, trimmedKey)
  }

  if (providerId === 'mimo-tts') {
    const config: AIProviderConfig = {
      id: providerId,
      type: providerId as ProviderType,
      name: providerId.toUpperCase(),
      apiKey: trimmedKey,
      baseUrl: trimmedUrl,
      isSystem: true,
      isEnabled: false,
      models: [],
      enabledModels: [],
      defaultDialogueModel: '',
      defaultNamingModel: '',
      sortOrder: 999
    }
    const registry = AIProviderRegistry.getInstance()
    const instance = registry.getOrUpdateProvider(config) as IAIProvider & {
      fetchAvailableModels?: () => Promise<string[]>
    }
    if (!instance.fetchAvailableModels) {
      throw new Error('Provider does not support fetchAvailableModels')
    }
    return instance.fetchAvailableModels()
  }

  const config: AIProviderConfig = {
    id: providerId,
    type: providerId as ProviderType,
    name: providerId.toUpperCase(),
    apiKey: trimmedKey,
    baseUrl: resolveProviderBaseUrl(providerId, providerId as ProviderType, trimmedUrl),
    isSystem: true,
    isEnabled: false,
    models: [],
    enabledModels: [],
    defaultDialogueModel: '',
    defaultNamingModel: '',
    sortOrder: 999
  }

  const registry = AIProviderRegistry.getInstance()
  const instance = registry.getOrUpdateProvider(config) as IAIProvider & {
    fetchAvailableModels?: () => Promise<string[]>
  }
  if (!instance.fetchAvailableModels) {
    throw new Error('Provider does not support fetchAvailableModels')
  }
  return instance.fetchAvailableModels()
}
