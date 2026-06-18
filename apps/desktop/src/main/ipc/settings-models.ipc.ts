import { ipcMain } from 'electron'
import {
  AIProviderConfig,
  GlobalModelsConfig,
  fetchOpenAiCompatibleModelIds,
  isTtsProviderId,
  logger,
  parseCloneTtsVoiceList,
  resolveProviderBaseUrl,
  resolveTtsProviderBaseUrl
} from '@baishou/shared'
import { AIProviderRegistry } from '@baishou/ai'
import { settingsManager } from './settings.ipc'
import {
  patchProviderConfigInStore,
  type ProviderConfigPatch
} from '../services/ai-provider-config.util'

const knownSystemIds = [
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'kimi',
  'ollama',
  'siliconflow',
  'openrouter',
  'dashscope',
  'doubao',
  'grok',
  'mistral',
  'lmstudio'
]

const TTS_FETCH_TIMEOUT_MS = 30_000
const GPT_SOVITS_GPT_DROPDOWN_ID = 5
const GPT_SOVITS_SOVITS_DROPDOWN_ID = 6

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TTS_FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
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

async function fetchGptSovitsModelIds(baseUrl: string): Promise<string[]> {
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

function withResolvedProviderBaseUrl(
  config: AIProviderConfig,
  tempKey?: string,
  tempUrl?: string
): AIProviderConfig {
  const clone = { ...config }
  if (tempKey !== undefined) {
    clone.apiKey = tempKey
  }
  const urlInput = tempUrl !== undefined ? tempUrl : clone.baseUrl
  clone.baseUrl = resolveProviderBaseUrl(clone.id, clone.type, urlInput)
  return clone
}

export async function getAutoFixedProviders(): Promise<AIProviderConfig[]> {
  const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
  let needsSave = false

  for (const p of providers) {
    const lowerId = p.id.toLowerCase()
    if (knownSystemIds.includes(lowerId)) {
      if (p.type === 'custom' || !p.type || p.type !== lowerId) {
        p.type = lowerId as any
        p.isSystem = true
        needsSave = true
      }
    }
  }

  if (needsSave) {
    await settingsManager.set('ai_providers', providers)
  }
  return providers.filter((p) => !isTtsProviderId(p.id))
}

/**
 * 注册与模型提供商、AI模型选择及连接测试相关的 IPC 通道
 */
export function registerSettingsModelsIPC() {
  ipcMain.handle('settings:get-providers', async () => {
    return await getAutoFixedProviders()
  })

  const pruneGlobalModels = async (providers: AIProviderConfig[]) => {
    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
    if (!globalModels) return

    let changed = false
    const isValid = (pId: string, mId: string) => {
      if (!pId || !mId) return true
      const prov = providers.find((p) => p.id === pId && p.isEnabled)
      if (!prov) return false
      if (prov.enabledModels && !prov.enabledModels.includes(mId)) return false
      return true
    }

    if (!isValid(globalModels.globalDialogueProviderId, globalModels.globalDialogueModelId)) {
      globalModels.globalDialogueProviderId = ''
      globalModels.globalDialogueModelId = ''
      changed = true
    }
    if (!isValid(globalModels.globalNamingProviderId, globalModels.globalNamingModelId)) {
      globalModels.globalNamingProviderId = ''
      globalModels.globalNamingModelId = ''
      changed = true
    }
    if (!isValid(globalModels.globalSummaryProviderId, globalModels.globalSummaryModelId)) {
      globalModels.globalSummaryProviderId = ''
      globalModels.globalSummaryModelId = ''
      changed = true
    }
    if (!isValid(globalModels.globalEmbeddingProviderId, globalModels.globalEmbeddingModelId)) {
      globalModels.globalEmbeddingProviderId = ''
      globalModels.globalEmbeddingModelId = ''
      changed = true
    }
    // TTS 配置独立于 ai_providers，不在此处裁剪

    if (changed) {
      await settingsManager.set('global_models', globalModels)
    }
  }

  ipcMain.handle('settings:set-providers', async (_, providers: AIProviderConfig[]) => {
    await settingsManager.set('ai_providers', providers)
    await pruneGlobalModels(providers)
    return true
  })

  ipcMain.handle(
    'settings:patch-provider',
    async (_, providerId: string, updates: ProviderConfigPatch) => {
      const providers = await getAutoFixedProviders()
      const { providers: nextProviders, provider } = patchProviderConfigInStore(
        providers,
        providerId,
        updates
      )
      await settingsManager.set('ai_providers', nextProviders)
      await pruneGlobalModels(nextProviders)
      return provider
    }
  )

  ipcMain.handle('settings:get-global-models', async () => {
    return (await settingsManager.get<GlobalModelsConfig>('global_models')) || null
  })

  ipcMain.handle('settings:set-global-models', async (_, config: GlobalModelsConfig) => {
    await settingsManager.set('global_models', config)
    return true
  })

  ipcMain.handle('settings:add-custom-provider', async (_, input: Partial<AIProviderConfig>) => {
    const providers = await getAutoFixedProviders()
    const maxSort = providers.reduce((max, p) => Math.max(max, p.sortOrder || 0), 0)
    const newProvider: AIProviderConfig = {
      id: `custom_${Date.now()}`,
      name: input.name || 'Custom Provider',
      type: input.type || 'openai',
      baseUrl: input.baseUrl || '',
      apiKey: input.apiKey || '',
      isSystem: false,
      isEnabled: true,
      sortOrder: maxSort + 1,
      enabledModels: [],
      ...input
    } as any
    providers.push(newProvider)
    await settingsManager.set('ai_providers', providers)
    return newProvider
  })

  ipcMain.handle('settings:delete-provider', async (_, providerId: string) => {
    const providers = await getAutoFixedProviders()
    const idx = providers.findIndex((p) => p.id === providerId)
    if (idx < 0) throw new Error('Provider not found')
    if (providers[idx].isSystem) throw new Error('Cannot delete system provider')
    providers.splice(idx, 1)
    await settingsManager.set('ai_providers', providers)
    await pruneGlobalModels(providers)
    return true
  })

  ipcMain.handle('settings:reorder-providers', async (_, orderedIds: string[]) => {
    const providers = await getAutoFixedProviders()

    orderedIds.forEach((id, index) => {
      const p = providers.find((pp) => pp.id === id)
      if (p) {
        p.sortOrder = index
      } else {
        providers.push({
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          type: id as any,
          isSystem: true,
          isEnabled: false,
          sortOrder: index,
          apiKey: '',
          baseUrl: '',
          models: [],
          enabledModels: [],
          defaultDialogueModel: '',
          defaultNamingModel: ''
        } as AIProviderConfig)
      }
    })

    await settingsManager.set('ai_providers', providers)
    return true
  })

  ipcMain.handle(
    'settings:test-connection',
    async (_, providerId: string, tempKey?: string, tempUrl?: string, testModelId?: string) => {
      const providers = await getAutoFixedProviders()
      let config = providers.find((p) => p.id === providerId)
      if (!config) {
        config = {
          id: providerId,
          type: providerId as any,
          name: providerId.toUpperCase(),
          apiKey: '',
          baseUrl: '',
          isSystem: true,
          isEnabled: false,
          models: [],
          enabledModels: [],
          defaultDialogueModel: '',
          defaultNamingModel: '',
          sortOrder: 999
        } as AIProviderConfig
      }

      const clone = withResolvedProviderBaseUrl(config, tempKey, tempUrl)

      // @ts-ignore
      const registry = AIProviderRegistry.getInstance()
      const provider = registry.createProviderInstance(clone)
      if (!provider) throw new Error('Provider instance creation failed')
      await provider.testConnection(testModelId)
      return { success: true }
    }
  )

  ipcMain.handle(
    'settings:fetch-models',
    async (_, providerId: string, tempKey?: string, tempUrl?: string) => {
      if (providerId === 'clone-tts') {
        try {
          const url = `${tempUrl?.replace(/\/$/, '')}/api/voices`
          const response = await fetchWithTimeout(url)
          if (response.ok) {
            const data = await response.json()
            return parseCloneTtsVoiceList(data)
          }
          return []
        } catch (err) {
          // @ts-ignore
          logger.error?.('[TTS] Fetch CloneTTS voices failed:', err)
          if (err instanceof Error && err.name === 'AbortError') {
            throw new Error(
              `请求超时（${TTS_FETCH_TIMEOUT_MS / 1000}s），请检查 CloneTTS 服务地址是否可达`
            )
          }
          return []
        }
      }

      if (providerId === 'mimo-tts') {
        const base = resolveTtsProviderBaseUrl('mimo-tts', tempUrl)
        const providers = await getAutoFixedProviders()
        let config = providers.find((p) => p.id === providerId)
        if (!config) {
          config = {
            id: providerId,
            type: providerId as any,
            name: providerId.toUpperCase(),
            apiKey: '',
            baseUrl: '',
            isSystem: true,
            isEnabled: false,
            models: [],
            enabledModels: [],
            defaultDialogueModel: '',
            defaultNamingModel: '',
            sortOrder: 999
          } as AIProviderConfig
        }
        const clone = withResolvedProviderBaseUrl({ ...config, baseUrl: base }, tempKey, base)
        const registry = AIProviderRegistry.getInstance()
        const provider = registry.createProviderInstance(clone)
        if (!provider) throw new Error('Provider instance creation failed')
        return provider.fetchAvailableModels()
      }

      if (providerId === 'openai-tts') {
        try {
          return await fetchOpenAiCompatibleModelIds(tempUrl || '', tempKey)
        } catch (err) {
          // @ts-ignore
          logger.error?.('[TTS] Fetch OpenAI-compatible models failed:', err)
          return ['tts-1', 'tts-1-hd']
        }
      }

      if (providerId === 'gpt-sovits') {
        try {
          const base = resolveTtsProviderBaseUrl('gpt-sovits', tempUrl)
          return await fetchGptSovitsModelIds(base)
        } catch (err) {
          logger.error?.('[TTS] Fetch GPT-SoVITS models failed:', err)
          if (err instanceof Error && err.name === 'AbortError') {
            throw new Error(
              `请求超时（${TTS_FETCH_TIMEOUT_MS / 1000}s），请检查 GPT-SoVITS 服务地址是否可达`
            )
          }
          return ['default']
        }
      }

      const providers = await getAutoFixedProviders()
      let config = providers.find((p) => p.id === providerId)
      if (!config) {
        config = {
          id: providerId,
          type: providerId as any,
          name: providerId.toUpperCase(),
          apiKey: '',
          baseUrl: '',
          isSystem: true,
          isEnabled: false,
          models: [],
          enabledModels: [],
          defaultDialogueModel: '',
          defaultNamingModel: '',
          sortOrder: 999
        } as AIProviderConfig
      }

      const clone = withResolvedProviderBaseUrl(config, tempKey, tempUrl)

      // @ts-ignore
      const registry = AIProviderRegistry.getInstance()
      const provider = registry.createProviderInstance(clone)
      if (!provider) throw new Error('Provider instance creation failed')

      const models = await provider.fetchAvailableModels()
      return models
    }
  )

  ipcMain.handle('settings:get-all-available-models', async () => {
    const providers = await getAutoFixedProviders()
    return providers
      .filter((p: any) => p.isEnabled || p.isActive)
      .map((p: any) => ({
        providerId: p.id,
        providerName: p.name,
        models: p.enabledModels || p.models || []
      }))
  })
}
