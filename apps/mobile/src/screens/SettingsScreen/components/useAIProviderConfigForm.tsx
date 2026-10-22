import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog, useNativeToast } from '@baishou/ui/native'
import { AIProviderConfig } from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { ProviderBrandIcon } from './ProviderBrandIcon'
import {
  buildAndCacheProviderListItems,
  computeSortOrderOnEnable,
  effectiveProviderBaseUrl,
  fetchProviderModelsViaRegistry,
  getChatModelsForTest,
  getProviderConfig,
  patchProviderInList,
  testProviderConnectionViaRegistry,
  type ProviderListItem
} from '../utils/provider-settings'

const MODEL_PAGE_SIZE = 10

/**
 * AI 供应商配置表单的数据与动作：本地草稿、模型拉取、连接测试和持久化。
 * 组件只负责渲染，避免表单 JSX 与持久化逻辑互相牵连。
 */
export function useAIProviderConfigForm(input: {
  providerId: string
  providerMeta?: ProviderListItem
  savedProviders: AIProviderConfig[]
  onProvidersChange: (next: AIProviderConfig[]) => void
}) {
  const { providerId, providerMeta, savedProviders, onProvidersChange } = input
  const { t } = useTranslation()
  const { services, dbReady } = useBaishou()
  const toast = useNativeToast()
  const dialog = useDialog()

  const [localApiKey, setLocalApiKey] = useState('')
  const [localBaseUrl, setLocalBaseUrl] = useState('')
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [modelVisibleCount, setModelVisibleCount] = useState(MODEL_PAGE_SIZE)
  const [isTesting, setIsTesting] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  const activeConfig = useMemo(
    () => getProviderConfig(savedProviders, providerId, providerMeta),
    [savedProviders, providerId, providerMeta]
  )

  useEffect(() => {
    setLocalApiKey(activeConfig.apiKey || '')
    setLocalBaseUrl(activeConfig.baseUrl || providerMeta?.defaultBase || '')
    setModelSearchQuery('')
    setModelVisibleCount(MODEL_PAGE_SIZE)
  }, [providerId, activeConfig.apiKey, activeConfig.baseUrl, providerMeta?.defaultBase])

  useEffect(() => {
    setModelVisibleCount(MODEL_PAGE_SIZE)
  }, [providerId, modelSearchQuery, activeConfig.models])

  const persistProvider = async (updates: Partial<AIProviderConfig>) => {
    if (!services || !dbReady) return
    const next = patchProviderInList(savedProviders, providerId, updates, providerMeta)
    await services.settingsManager.set('ai_providers', next)
    onProvidersChange(next)
  }

  const handleSaveConfig = async () => {
    const baseUrl = effectiveProviderBaseUrl(
      providerId,
      activeConfig.type,
      localBaseUrl,
      providerMeta?.defaultBase || ''
    )
    try {
      const shouldEnable = !activeConfig.isEnabled && localApiKey.trim().length > 0
      const updates: Partial<AIProviderConfig> = { apiKey: localApiKey, baseUrl }
      if (shouldEnable) {
        const items = buildAndCacheProviderListItems(savedProviders, t)
        updates.isEnabled = true
        updates.sortOrder = computeSortOrderOnEnable(items)
      }
      await persistProvider(updates)
      toast.showSuccess(t('ai_config.save_success', { id: providerId }))
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : t('ai_config.save_failed'))
    }
  }

  const handleResetConfig = () => {
    setLocalBaseUrl(providerMeta?.defaultBase || '')
    setLocalApiKey('')
    toast.showSuccess(t('ai_config.reset_success'))
  }

  const normalizeBaseUrlOnBlur = (url: string) => {
    if (url.includes('generativelanguage.googleapis.com') && !url.includes('v1')) {
      return url.replace(/\/+$/, '') + '/v1beta'
    }
    return url
  }

  const handleToggleEnable = async (enabled: boolean) => {
    if (enabled) {
      const items = buildAndCacheProviderListItems(savedProviders, t)
      const sortOrder = computeSortOrderOnEnable(items)
      await persistProvider({ isEnabled: enabled, sortOrder })
      return
    }
    await persistProvider({ isEnabled: enabled })
  }

  const handleFetchModels = async () => {
    if (!localApiKey.trim()) {
      toast.showWarning(t('ai_config.fill_api_key_hint'))
      return
    }
    const baseUrl = effectiveProviderBaseUrl(
      providerId,
      activeConfig.type,
      localBaseUrl,
      providerMeta?.defaultBase || ''
    )
    setIsFetching(true)
    try {
      await persistProvider({ apiKey: localApiKey, baseUrl })
      const config = getProviderConfig(savedProviders, providerId, providerMeta)
      const models = await fetchProviderModelsViaRegistry(
        { ...config, apiKey: localApiKey, baseUrl },
        localApiKey,
        baseUrl
      )
      // 新获取的模型默认全部关闭，仅保留用户此前已启用的模型
      const prevEnabled = new Set(config.enabledModels || [])
      const enabledModels = models.filter((m) => prevEnabled.has(m))
      const shouldEnable = !config.isEnabled
      const items = shouldEnable ? buildAndCacheProviderListItems(savedProviders, t) : []
      await persistProvider({
        models,
        enabledModels,
        apiKey: localApiKey,
        baseUrl,
        ...(shouldEnable ? { isEnabled: true, sortOrder: computeSortOrderOnEnable(items) } : {})
      })
      toast.showSuccess(t('ai_config.fetch_models_success'))
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : t('ai_config.fetch_models_failed'))
    } finally {
      setIsFetching(false)
    }
  }

  const runTestConnection = async (testModelId: string) => {
    const baseUrl = effectiveProviderBaseUrl(
      providerId,
      activeConfig.type,
      localBaseUrl,
      providerMeta?.defaultBase || ''
    )
    setIsTesting(true)
    try {
      await persistProvider({ apiKey: localApiKey, baseUrl })
      const config = getProviderConfig(savedProviders, providerId, providerMeta)
      await testProviderConnectionViaRegistry(
        { ...config, apiKey: localApiKey, baseUrl },
        localApiKey,
        baseUrl,
        testModelId
      )
      toast.showSuccess(t('ai_config.test_connection_success'))
    } catch (e: unknown) {
      toast.showError(
        t('ai_config.test_connection_failed', {
          e: e instanceof Error ? e.message : String(e)
        })
      )
    } finally {
      setIsTesting(false)
    }
  }

  const handleTestConnection = async () => {
    if (!localApiKey.trim()) {
      toast.showWarning(t('ai_config.fill_api_key_hint'))
      return
    }
    const chatModels = getChatModelsForTest(activeConfig)
    if (chatModels.length === 0) {
      toast.showWarning(t('ai_config.no_chat_models_for_test'))
      return
    }
    if (chatModels.length === 1) {
      await runTestConnection(chatModels[0])
      return
    }
    const picked = await dialog.choose(
      t('ai_config.test_connection_title', '选择测试模型'),
      chatModels.map((modelId) => ({
        label: modelId,
        value: modelId,
        leading: <ProviderBrandIcon providerId={providerId} size={18} />
      })),
      t('ai_config.test_connection_desc')
    )
    if (picked) await runTestConnection(picked)
  }

  const handleDeleteProvider = async () => {
    if (activeConfig.isSystem) {
      toast.showWarning(t('settings.provider_disabled'))
      return
    }
    const providerName = activeConfig.name || providerMeta?.name || providerId
    const confirmed = await dialog.confirm(
      t('agent.provider.delete_confirm', '确定要删除"$name"吗？').replace('$name', providerName),
      {
        title: t('agent.provider.delete_title', '删除供应商'),
        confirmText: t('common.delete'),
        destructive: true
      }
    )
    if (!confirmed || !services || !dbReady) return
    const next = savedProviders.filter((p) => p.id !== providerId)
    await services.settingsManager.set('ai_providers', next)
    onProvidersChange(next)
    toast.showSuccess(t('common.delete_success'))
  }

  const sortedDisplayModels = useMemo(() => {
    const models = activeConfig.models || []
    const enabledSet = new Set(activeConfig.enabledModels || [])
    const q = modelSearchQuery.trim().toLowerCase()
    return [...models]
      .filter((m) => !q || m.toLowerCase().includes(q))
      .sort((a, b) => {
        const aOn = enabledSet.has(a)
        const bOn = enabledSet.has(b)
        if (aOn !== bOn) return aOn ? -1 : 1
        return a.localeCompare(b)
      })
  }, [activeConfig.models, activeConfig.enabledModels, modelSearchQuery])

  const visibleModels = useMemo(
    () => sortedDisplayModels.slice(0, modelVisibleCount),
    [sortedDisplayModels, modelVisibleCount]
  )

  const hasMoreModels = modelVisibleCount < sortedDisplayModels.length
  const showAllLoadedHint = !hasMoreModels && sortedDisplayModels.length > MODEL_PAGE_SIZE

  const toggleModelEnabled = async (modelId: string, nextEnabled?: boolean) => {
    const currentConfig = getProviderConfig(savedProviders, providerId, providerMeta)
    const enabled = new Set(currentConfig.enabledModels || [])
    const shouldEnable = nextEnabled ?? !enabled.has(modelId)
    if (shouldEnable) enabled.add(modelId)
    else enabled.delete(modelId)
    await persistProvider({ enabledModels: Array.from(enabled) })
  }

  const loadMoreModels = () => {
    setModelVisibleCount((count) => count + MODEL_PAGE_SIZE)
  }

  return {
    activeConfig,
    localApiKey,
    setLocalApiKey,
    localBaseUrl,
    setLocalBaseUrl,
    modelSearchQuery,
    setModelSearchQuery,
    isTesting,
    isFetching,
    normalizeBaseUrlOnBlur,
    handleSaveConfig,
    handleResetConfig,
    handleToggleEnable,
    handleFetchModels,
    handleTestConnection,
    handleDeleteProvider,
    sortedDisplayModels,
    visibleModels,
    hasMoreModels,
    showAllLoadedHint,
    toggleModelEnabled,
    loadMoreModels
  }
}
