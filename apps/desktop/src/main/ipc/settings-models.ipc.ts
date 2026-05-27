import { ipcMain } from 'electron'
import { AIProviderConfig, GlobalModelsConfig, logger } from '@baishou/shared'
import { settingsManager } from './settings.ipc'

/**
 * 注册与模型提供商、AI模型选择及连接测试相关的 IPC 通道
 */
export function registerSettingsModelsIPC() {
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

  const getAutoFixedProviders = async () => {
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
    return providers
  }

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
    if (!isValid(globalModels.globalTtsProviderId, globalModels.globalTtsModelId)) {
      globalModels.globalTtsProviderId = ''
      globalModels.globalTtsModelId = ''
      changed = true
    }

    if (changed) {
      await settingsManager.set('global_models', globalModels)
    }
  }

  ipcMain.handle('settings:set-providers', async (_, providers: AIProviderConfig[]) => {
    await settingsManager.set('ai_providers', providers)
    await pruneGlobalModels(providers)
    return true
  })

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

      const clone = { ...config } as AIProviderConfig
      if (tempKey !== undefined) clone.apiKey = tempKey
      if (tempUrl !== undefined) clone.baseUrl = tempUrl

      // @ts-ignore
      const { AIProviderRegistry } = await import('@baishou/ai/src/providers/provider.registry')
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

      if (providerId === 'openai-tts') {
        const base = tempUrl?.trim().replace(/\/$/, '') || ''
        if (!base) {
          return ['tts-1', 'tts-1-hd']
        }
        try {
          const headers: Record<string, string> = {}
          const key = tempKey?.trim()
          if (key) {
            headers.Authorization = `Bearer ${key}`
          }
          const response = await fetch(`${base}/models`, { headers })
          if (response.ok) {
            const data = await response.json()
            if (data && Array.isArray(data.data)) {
              const allIds = data.data.map((m: any) => m.id).filter(Boolean) as string[]
              const ttsModels = allIds.filter((id) => id.toLowerCase().includes('tts'))
              if (ttsModels.length > 0) return ttsModels
              if (allIds.length > 0) return allIds
            }
          }
        } catch (err) {
          // @ts-ignore
          logger.error?.('[TTS] Fetch OpenAI-compatible models failed:', err)
        }
        return ['tts-1', 'tts-1-hd']
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

      const clone = { ...config } as AIProviderConfig
      if (tempKey !== undefined) clone.apiKey = tempKey
      if (tempUrl !== undefined) clone.baseUrl = tempUrl

      // @ts-ignore
      const { AIProviderRegistry } = await import('@baishou/ai/src/providers/provider.registry')
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
