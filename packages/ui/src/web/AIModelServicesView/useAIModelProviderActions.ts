import React, { useState, useEffect } from 'react'
import type { TFunction } from 'i18next'
import { renderProviderIcon, renderProviderTypeIcon } from './ai-model-services.icons'
import { isChatModelForConnectionTest, resolveProviderBaseUrl } from '@baishou/shared'
import type { AIProviderConfig, AIModelServicesViewProps } from './ai-model-services.types'

export interface UseAIModelProviderActionsParams {
  t: TFunction
  toast: ReturnType<typeof import('../Toast/useToast').useToast>
  dialog: ReturnType<typeof import('../Dialog').useDialog>
  providers: AIModelServicesViewProps['providers']
  onUpdateProvider: AIModelServicesViewProps['onUpdateProvider']
  onDeleteProvider: AIModelServicesViewProps['onDeleteProvider']
  onTestConnection: AIModelServicesViewProps['onTestConnection']
  onFetchModels: AIModelServicesViewProps['onFetchModels']
  selectedProviderId: string
  setSelectedProviderId: (id: string) => void
  localFormData: { baseUrl: string; apiKey: string }
  setLocalFormData: React.Dispatch<React.SetStateAction<{ baseUrl: string; apiKey: string }>>
  activeProviderMeta: {
    id: string
    name: string
    defaultBase: string
    iconUrl?: string
    isSystem?: boolean
  }
  activeConfig: AIProviderConfig
  setIsTesting: (v: boolean) => void
  setIsFetchingModels: (v: boolean) => void
  setIsTestModalOpen: (v: boolean) => void
  setTestModelId: (v: string) => void
  setTestModelOptions: (v: string[]) => void
  testModelId: string
  setIsAddModalOpen: (v: boolean) => void
  setIsTypeDropdownOpen: (v: boolean) => void
  addModalData: { name: string; type: string; baseUrl: string }
  setAddModalData: React.Dispatch<
    React.SetStateAction<{ name: string; type: string; baseUrl: string }>
  >
  firstProviderId: string | undefined
  localProvidersList: Array<{ id: string; name: string; iconUrl?: string; isSystem?: boolean }>
  BASE_KNOWN_PROVIDERS: Array<{ id: string; name: string; iconUrl?: string }>
}

export function useAIModelProviderActions(params: UseAIModelProviderActionsParams) {
  const {
    t,
    toast,
    dialog,
    providers,
    onUpdateProvider,
    onDeleteProvider,
    onTestConnection,
    onFetchModels,
    selectedProviderId,
    setSelectedProviderId,
    localFormData,
    setLocalFormData,
    activeProviderMeta,
    activeConfig,
    setIsTesting,
    setIsFetchingModels,
    setIsTestModalOpen,
    setTestModelId,
    setTestModelOptions,
    testModelId,
    setIsAddModalOpen,
    setIsTypeDropdownOpen,
    addModalData,
    setAddModalData,
    firstProviderId,
    localProvidersList,
    BASE_KNOWN_PROVIDERS
  } = params

  const persistProviderUpdate = (providerId: string, updates: Partial<AIProviderConfig>) =>
    Promise.resolve(onUpdateProvider(providerId, updates))

  const providerType = () => activeConfig.type ?? selectedProviderId

  const effectiveBaseUrl = () =>
    resolveProviderBaseUrl(selectedProviderId, providerType(), localFormData.baseUrl)

  const populateControllers = (pid: string) => {
    const config: Partial<AIProviderConfig> = providers[pid] || {}
    setLocalFormData({
      baseUrl: config.apiBaseUrl || '',
      apiKey: config.apiKey || ''
    })
  }

  const handleProviderTap = (id: string) => {
    if (selectedProviderId !== id) {
      setSelectedProviderId(id)
    }
  }

  const handleSaveCurrentProviderConfig = () => {
    void persistProviderUpdate(selectedProviderId, {
      apiBaseUrl: effectiveBaseUrl(),
      apiKey: localFormData.apiKey
    })
      .then(() => {
        toast.showSuccess(t('ai_config.save_success', '$id 配置已保存', { id: selectedProviderId }))
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e)
        toast.showError(t('ai_config.save_failed', '保存失败: {{message}}', { message }))
      })
  }

  const handleResetCurrentProvider = () => {
    setLocalFormData({
      baseUrl: activeProviderMeta.defaultBase,
      apiKey: ''
    })
    toast.showSuccess(t('ai_config.reset_success', '已恢复默认地址并清空 API Key，请点击保存'))
  }

  const handleBaseUrlBlur = () => {
    let url = localFormData.baseUrl
    if (url && url.includes('generativelanguage.googleapis.com') && !url.includes('v1')) {
      url = url.replace(/\/+$/, '') + '/v1beta'
    }
    if (url !== localFormData.baseUrl) {
      setLocalFormData((prev) => ({ ...prev, baseUrl: url }))
    }
  }

  const handleTestConnection = async () => {
    console.log('[TestConnection] handleTestConnection clicked', {
      onTestConnection: !!onTestConnection,
      apiKey: !!localFormData.apiKey
    })
    if (!onTestConnection) return
    if (!localFormData.apiKey) {
      toast.showError(t('ai_config.fill_api_key_hint', '请先填写 API Key 并保存'))
      return
    }

    const listed = activeConfig.enabledModels?.length
      ? activeConfig.enabledModels
      : activeConfig.models
    const chatModels = (listed || []).filter((m) => isChatModelForConnectionTest(m))
    console.log('[TestConnection] chat models for test:', chatModels)
    if (!chatModels.length) {
      toast.showWarning(
        t(
          'ai_config.no_chat_models_for_test',
          '没有可用于测试连接的大语言模型。请先获取模型列表，并启用对话模型（非 Embedding/TTS）。'
        )
      )
      return
    }

    const defaultDialogue = activeConfig.defaultDialogueModel
    const initialModel =
      defaultDialogue && isChatModelForConnectionTest(defaultDialogue)
        ? defaultDialogue
        : chatModels[0]

    setTestModelOptions(chatModels)
    setTestModelId(initialModel || '')
    console.log('[TestConnection] opening modal with default:', initialModel)
    setIsTestModalOpen(true)
  }

  const confirmTestConnection = async () => {
    if (!testModelId.trim()) {
      toast.showError(t('ai_config.test_model_empty', '测试模型 ID 不能为空'))
      return
    }
    if (!isChatModelForConnectionTest(testModelId.trim())) {
      toast.showError(
        t(
          'ai_config.test_model_not_chat',
          '请选择大语言模型进行连接测试，Embedding/TTS 模型不支持此测试。'
        )
      )
      return
    }
    setIsTestModalOpen(false)

    await persistProviderUpdate(selectedProviderId, {
      apiBaseUrl: effectiveBaseUrl(),
      apiKey: localFormData.apiKey
    })

    setIsTesting(true)
    try {
      await onTestConnection(
        selectedProviderId,
        localFormData.apiKey,
        effectiveBaseUrl(),
        testModelId.trim()
      )
      toast.showSuccess(t('ai_config.test_connection_success', '连接测试成功！🎉'))
    } catch (e: any) {
      toast.showError(
        t('ai_config.test_connection_failed', '连接失败: {{e}}', {
          e: e.message || 'Unknown error'
        })
      )
    } finally {
      setIsTesting(false)
    }
  }

  const handleFetchModels = async () => {
    if (!onFetchModels) return
    if (!localFormData.apiKey) {
      toast.showError(t('ai_config.fill_api_key_hint', '请先填写 API Key 并保存'))
      return
    }

    await persistProviderUpdate(selectedProviderId, {
      apiBaseUrl: effectiveBaseUrl(),
      apiKey: localFormData.apiKey
    })

    setIsFetchingModels(true)
    try {
      const RemoteModels = await onFetchModels(
        selectedProviderId,
        localFormData.apiKey,
        effectiveBaseUrl()
      )
      const oldEnabled = new Set(activeConfig.enabledModels || [])
      const newEnabled = RemoteModels.filter((rm) => oldEnabled.has(rm))

      await persistProviderUpdate(selectedProviderId, {
        models: RemoteModels,
        enabledModels: newEnabled
      })
      toast.showSuccess(t('ai_config.fetch_models_success', '成功获取并保存模型列表'))
    } catch (e: any) {
      toast.showError(
        t('ai_config.fetch_models_failed', '获取模型失败: {{e}}', {
          e: e.message || 'Unknown error'
        })
      )
    } finally {
      setIsFetchingModels(false)
    }
  }

  const handleDeleteProvider = async () => {
    const confirmStr = t(
      'agent.provider.delete_confirm',
      `确定要删除"${activeProviderMeta.name}"吗？`
    )
      .replace('$name', activeProviderMeta.name)
      .replace('{{name}}', activeProviderMeta.name)
    const res = await dialog.confirm(confirmStr)
    if (res) {
      if (onDeleteProvider) onDeleteProvider(selectedProviderId)
      setSelectedProviderId(firstProviderId || '')
    }
  }

  const handleAddCustomProvider = () => {
    setAddModalData({ name: '', type: 'openai', baseUrl: '' })
    setIsTypeDropdownOpen(false)
    setIsAddModalOpen(true)
  }

  const submitAddCustomProvider = () => {
    if (!addModalData.name.trim()) return
    const pid = 'custom_' + Date.now()
    onUpdateProvider(pid, {
      name: addModalData.name.trim(),
      type: addModalData.type,
      apiBaseUrl: addModalData.baseUrl.trim(),
      isSystem: false,
      enabled: true,
      apiKey: ''
    })
    setIsAddModalOpen(false)
    setSelectedProviderId(pid)
  }

  const handleToggleEnable = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = e.target.checked
    if (isEnabled) {
      // 启用时，将排序设为已启用列表末尾（最大 sortOrder + 1）
      const enabledOrders = localProvidersList
        .filter((p) => providers[p.id]?.enabled)
        .map((p) => providers[p.id]?.sortOrder ?? 999)
      const nextOrder = enabledOrders.length > 0 ? Math.max(...enabledOrders) + 1 : 0
      onUpdateProvider(selectedProviderId, {
        enabled: true,
        sortOrder: nextOrder
      })
    } else {
      onUpdateProvider(selectedProviderId, { enabled: false })
    }
  }

  const handleModelToggle = (mdl: string, isChecked: boolean) => {
    const activeList = [...(activeConfig.enabledModels || [])]
    if (isChecked) {
      if (!activeList.includes(mdl)) activeList.push(mdl)
    } else {
      const idx = activeList.indexOf(mdl)
      if (idx !== -1) activeList.splice(idx, 1)
    }
    onUpdateProvider(selectedProviderId, { enabledModels: activeList })
  }

  return {
    handleProviderTap,
    handleSaveCurrentProviderConfig,
    handleResetCurrentProvider,
    handleBaseUrlBlur,
    handleTestConnection,
    confirmTestConnection,
    handleFetchModels,
    handleDeleteProvider,
    handleAddCustomProvider,
    submitAddCustomProvider,
    handleToggleEnable,
    handleModelToggle,
    renderIcon: renderProviderIcon,
    renderTypeIcon: renderProviderTypeIcon,
    populateControllers
  }
}
