import { ipcMain } from 'electron'
import {
  AIProviderConfig,
  GlobalModelsConfig,
  fetchOpenAiCompatibleModelIds,
  isTtsProviderId,
  logger,
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
          const response = await fetch(url)
          if (response.ok) {
            const data = await response.json()
            if (Array.isArray(data)) {
              return data
                .map((item: any) => item.alias || item.name || String(item))
                .filter(Boolean)
            }
          }
          return []
        } catch (err) {
          // @ts-ignore
          logger.error?.('[TTS] Fetch CloneTTS voices failed:', err)
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
