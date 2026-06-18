import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  formatDialogueModelLabel,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  resolveDialogueModelSelection,
  type GlobalModelsConfig
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import { useAgentNavigationStore } from '@baishou/store'
import { listAssistantsForUi, type MobileAssistantUi } from '../lib/mobile-assistant.util'
import { waitForVaultEcosystemResync } from '../services/mobile-vault-resync.service'

type Assistant = MobileAssistantUi

export interface UseAgentModelOptions {
  /** @deprecated 请改用 syncWithSession */
  currentSessionId?: string | null
}

export function useAgentModel(_options: UseAgentModelOptions = {}) {
  const { services, dbReady, storageReady, vaultRevision, storageIndexing, ecosystemResyncEpoch } =
    useBaishou()

  const [currentAssistant, setCurrentAssistant] = useState<Assistant | null>(null)
  const [showAssistantPicker, setShowAssistantPicker] = useState(false)
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)

  const [globalModels, setGlobalModels] = useState<GlobalModelsConfig | null>(null)
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null)
  const [currentModelId, setCurrentModelId] = useState<string | null>(null)

  const userManuallySetModelRef = useRef(false)
  const prevSessionIdRef = useRef<string | null | undefined>(null)

  const applyResolvedModel = useCallback(
    (assistant: Assistant | null, models: GlobalModelsConfig | null) => {
      if (userManuallySetModelRef.current) return

      const resolved = resolveDialogueModelSelection({
        assistantProviderId: assistant?.providerId,
        assistantModelId: assistant?.modelId,
        globalDialogueProviderId: models?.globalDialogueProviderId,
        globalDialogueModelId: models?.globalDialogueModelId
      })

      setCurrentProviderId(resolved.providerId)
      setCurrentModelId(resolved.modelId)
    },
    []
  )

  const syncWithSession = useCallback(
    (sessionId: string | null | undefined) => {
      if (prevSessionIdRef.current === sessionId) return
      prevSessionIdRef.current = sessionId ?? null
      userManuallySetModelRef.current = false
      applyResolvedModel(currentAssistant, globalModels)
    },
    [applyResolvedModel, currentAssistant, globalModels]
  )

  useEffect(() => {
    applyResolvedModel(currentAssistant, globalModels)
  }, [currentAssistant, globalModels, applyResolvedModel])

  /** 从设置页返回时重载 global_models（桌面端由 settings store 响应式同步） */
  const reloadGlobalModels = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const nextGlobalModels =
        (await services.settingsManager.get<GlobalModelsConfig>('global_models')) || null
      setGlobalModels(nextGlobalModels)
    } catch (e) {
      console.warn('Failed to reload global models', e)
    }
  }, [dbReady, services])

  useFocusEffect(
    useCallback(() => {
      void reloadGlobalModels()
    }, [reloadGlobalModels])
  )

  // 加载默认助手和全局模型；工作区切换后随 vaultRevision 重载（对齐桌面 AgentLayout）
  useEffect(() => {
    if (!dbReady || !services || !storageReady) return

    const loadDefaultConfig = async () => {
      try {
        if (storageIndexing) {
          await waitForVaultEcosystemResync()
        }

        const assistants = await listAssistantsForUi(
          services.assistantManager,
          services.attachmentManager,
          services.fileSystem,
          { preferFileUri: true, skipAvatarResolve: true }
        )

        const nextGlobalModels =
          (await services.settingsManager.get<GlobalModelsConfig>('global_models')) || null
        setGlobalModels(nextGlobalModels)

        const vaultKey = await services.pathService.getActiveVaultNameForContext()
        const persisted = useAgentNavigationStore.getState().getContext(vaultKey)

        setCurrentAssistant((prev) => {
          const stillValid = prev && assistants.find((a) => a.id === prev.id)
          const fromPersisted =
            persisted.assistantId &&
            assistants.find((assistant) => assistant.id === persisted.assistantId)
          const next =
            stillValid ||
            fromPersisted ||
            assistants.find((a) => a.isDefault) ||
            assistants[0] ||
            null
          if (!userManuallySetModelRef.current) {
            applyResolvedModel(next, nextGlobalModels)
          }
          return next
        })
      } catch (e) {
        console.warn('Failed to load default config', e)
      }
    }

    void loadDefaultConfig()
  }, [
    dbReady,
    services,
    storageReady,
    vaultRevision,
    storageIndexing,
    ecosystemResyncEpoch,
    applyResolvedModel
  ])

  const handleSelectAssistant = useCallback(
    (assistant: Assistant) => {
      setCurrentAssistant(assistant)
      setShowAssistantPicker(false)
      userManuallySetModelRef.current = false
      applyResolvedModel(assistant, globalModels)
    },
    [applyResolvedModel, globalModels]
  )

  const handleSelectModel = useCallback((providerId: string, modelId: string) => {
    userManuallySetModelRef.current = true
    setCurrentProviderId(providerId)
    setCurrentModelId(modelId)
    setShowModelSwitcher(false)
  }, [])

  const displayModelName = formatDialogueModelLabel(currentModelId)
  const hasConfiguredDialogueModel =
    isConfiguredProviderId(currentProviderId) && isConfiguredDialogueModelId(currentModelId)

  return {
    currentAssistant,
    currentProviderId,
    currentModelId,
    displayModelName,
    hasConfiguredDialogueModel,
    globalModels,
    showAssistantPicker,
    showModelSwitcher,
    setCurrentAssistant,
    setCurrentProviderId,
    setCurrentModelId,
    setShowAssistantPicker,
    setShowModelSwitcher,
    handleSelectAssistant,
    handleSelectModel,
    syncWithSession
  }
}
