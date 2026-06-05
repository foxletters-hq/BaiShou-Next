import { AIProviderRegistry, type IAIProvider } from '@baishou/ai'
import { AIProviderConfig, ProviderType, resolveProviderBaseUrl } from '@baishou/shared'

/** 与桌面 settings:fetch-models 中 TTS 相关分支保持一致 */
export async function fetchTtsProviderModels(
  providerId: string,
  apiKey: string,
  baseUrl: string
): Promise<string[]> {
  const trimmedUrl = baseUrl.trim().replace(/\/$/, '')
  const trimmedKey = apiKey.trim()

  if (providerId === 'clone-tts') {
    if (!trimmedUrl) return []
    try {
      const response = await fetch(`${trimmedUrl}/api/voices`)
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          return data
            .map((item: { alias?: string; name?: string }) => item.alias || item.name || String(item))
            .filter(Boolean)
        }
      }
    } catch {
      return []
    }
    return []
  }

  if (providerId === 'openai-tts') {
    if (!trimmedUrl) {
      return ['tts-1', 'tts-1-hd']
    }
    try {
      const headers: Record<string, string> = {}
      if (trimmedKey) {
        headers.Authorization = `Bearer ${trimmedKey}`
      }
      const response = await fetch(`${trimmedUrl}/models`, { headers })
      if (response.ok) {
        const data = await response.json()
        if (data && Array.isArray(data.data)) {
          const allIds = data.data.map((m: { id?: string }) => m.id).filter(Boolean) as string[]
          const ttsModels = allIds.filter((id) => id.toLowerCase().includes('tts'))
          if (ttsModels.length > 0) return ttsModels
          if (allIds.length > 0) return allIds
        }
      }
    } catch {
      // fall through to defaults
    }
    return ['tts-1', 'tts-1-hd']
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
