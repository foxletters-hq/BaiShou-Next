import { useState, useRef, useEffect, useCallback } from 'react'
import { useSettingsStore } from '@baishou/store'
import {
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
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
  /** 手动选模：更新 UI，并在有会话时写回 Sessions/*.json（供增量同步跨端） */
  selectDialogueModel: (providerId: string, modelId: string) => Promise<void>
  userManuallySetModelRef: React.MutableRefObject<boolean>
}

/**
 * 模型选择 Hook
 *
 * 职责：
 * 1. 优先恢复会话已持久化的模型，再回退到伙伴/全局默认
 * 2. 用户手动切换时写回会话，随增量同步带到另一端
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
    const sessionChanged = prevSessionIdRef.current !== (sessionId || null)
    if (sessionChanged) {
      userManuallySetModelRef.current = false
      prevSessionIdRef.current = sessionId || null
    }

    let cancelled = false

    const syncFromSessionOrDefaults = async () => {
      if (sessionId && typeof window !== 'undefined' && window.electron) {
        try {
          const session = await window.electron.ipcRenderer.invoke('agent:get-session', sessionId)
          if (
            !cancelled &&
            session &&
            isConfiguredProviderId(session.providerId) &&
            isConfiguredDialogueModelId(session.modelId)
          ) {
            userManuallySetModelRef.current = true
            setCurrentProviderId(String(session.providerId).trim())
            setCurrentModelId(String(session.modelId).trim())
            return
          }
        } catch (e) {
          console.warn('[useModelSelection] load session model failed', e)
        }
      }

      if (cancelled || userManuallySetModelRef.current) return

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
    }

    void syncFromSessionOrDefaults()
    return () => {
      cancelled = true
    }
  }, [sessionId, currentAssistant, settings.globalModels, fallbackProviderId, fallbackModelId])

  const selectDialogueModel = useCallback(
    async (providerId: string, modelId: string) => {
      userManuallySetModelRef.current = true
      setCurrentProviderId(providerId)
      setCurrentModelId(modelId)

      if (
        !sessionId ||
        typeof window === 'undefined' ||
        !window.electron ||
        !isConfiguredProviderId(providerId) ||
        !isConfiguredDialogueModelId(modelId)
      ) {
        return
      }

      try {
        await window.electron.ipcRenderer.invoke(
          'agent:update-session-dialogue-model',
          sessionId,
          providerId,
          modelId
        )
      } catch (e) {
        console.warn('[useModelSelection] persist session model failed', e)
      }
    },
    [sessionId]
  )

  return {
    currentProviderId,
    currentModelId,
    setCurrentProviderId,
    setCurrentModelId,
    selectDialogueModel,
    userManuallySetModelRef
  }
}
