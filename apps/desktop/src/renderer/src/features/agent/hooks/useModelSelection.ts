import { useState, useRef, useEffect } from 'react'
import { useSettingsStore } from '@baishou/store'
import {
  resolveDialogueModelSelection,
  resolveProviderListDialogueFallback
} from '@baishou/shared'

export interface UseModelSelectionParams {
  sessionId: string | undefined
  currentAssistant: any
}

export interface UseModelSelectionResult {
  currentProviderId: string
  currentModelId: string
  setCurrentProviderId: (id: string) => void
  setCurrentModelId: (id: string) => void
  userManuallySetModelRef: React.MutableRefObject<boolean>
}

/**
 * 模型选择 Hook
 *
 * 职责：
 * 1. 根据助手/全局设置推导默认模型
 * 2. 支持用户手动切换模型
 * 3. 会话切换时重置手动标记
 */
export function useModelSelection(params: UseModelSelectionParams): UseModelSelectionResult {
  const { sessionId, currentAssistant } = params
  const settings = useSettingsStore()

  const providers = settings?.providers || []
  const providerFallback = resolveProviderListDialogueFallback(providers)
  const fallbackProviderId = providerFallback.providerId || 'unknown'
  const fallbackModelId = providerFallback.modelId || 'unknown'

  const initialResolved = resolveDialogueModelSelection({
    globalDialogueProviderId: settings.globalModels?.globalDialogueProviderId,
    globalDialogueModelId: settings.globalModels?.globalDialogueModelId,
    fallbackProviderId,
    fallbackModelId
  })

  const [currentProviderId, setCurrentProviderId] = useState<string>(
    initialResolved.providerId || fallbackProviderId
  )
  const [currentModelId, setCurrentModelId] = useState<string>(
    initialResolved.modelId || fallbackModelId
  )
  const userManuallySetModelRef = useRef<boolean>(false)
  const prevSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      userManuallySetModelRef.current = false
      prevSessionIdRef.current = sessionId || null
    }

    if (userManuallySetModelRef.current) return

    const resolved = resolveDialogueModelSelection({
      assistantProviderId: (currentAssistant as any)?.providerId,
      assistantModelId: (currentAssistant as any)?.modelId,
      globalDialogueProviderId: settings.globalModels?.globalDialogueProviderId,
      globalDialogueModelId: settings.globalModels?.globalDialogueModelId,
      fallbackProviderId,
      fallbackModelId
    })

    if (resolved.providerId && resolved.modelId) {
      setCurrentProviderId(resolved.providerId)
      setCurrentModelId(resolved.modelId)
      return
    }

    setCurrentProviderId(fallbackProviderId)
    setCurrentModelId(fallbackModelId)
  }, [
    sessionId,
    currentAssistant,
    settings.globalModels,
    fallbackProviderId,
    fallbackModelId
  ])

  return {
    currentProviderId,
    currentModelId,
    setCurrentProviderId,
    setCurrentModelId,
    userManuallySetModelRef
  }
}
