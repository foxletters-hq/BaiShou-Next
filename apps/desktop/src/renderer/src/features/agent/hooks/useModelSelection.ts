import { useState, useRef, useEffect, useCallback } from 'react'
import { useSettingsStore } from '@baishou/store'
import {
  type AIProviderConfig,
  buildAgentDialogueSelectionState,
  detectDialogueSelectionSwitches,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  resolveDialogueModelSelection,
  type AgentDialogueSelectionState,
  type AgentDialogueSelectionSwitchEvent,
  type DialogueModelSelectionSource,
  UNCONFIGURED_DIALOGUE_MODEL_SENTINEL
} from '@baishou/shared'
import { isDraftChatSessionId } from '../utils/draft-chat-session.util'
import { peekChatInitMeta } from './chat-init-meta.util'

export interface UseModelSelectionParams {
  sessionId: string | undefined
  currentAssistant: { id?: string | number; providerId?: string; modelId?: string } | undefined
}

export interface UseModelSelectionResult {
  currentProviderId: string
  currentModelId: string
  modelSelectionSource: DialogueModelSelectionSource
  selectionState: AgentDialogueSelectionState
  lastSelectionSwitch: AgentDialogueSelectionSwitchEvent | null
  setCurrentProviderId: (id: string) => void
  setCurrentModelId: (id: string) => void
  selectDialogueModel: (providerId: string, modelId: string) => Promise<void>
  userManuallySetModelRef: React.MutableRefObject<boolean>
}

function applyResolvedToUi(resolved: ReturnType<typeof resolveDialogueModelSelection>): {
  providerId: string
  modelId: string
} {
  return {
    providerId: resolved.providerId ?? UNCONFIGURED_DIALOGUE_MODEL_SENTINEL,
    modelId: resolved.modelId ?? UNCONFIGURED_DIALOGUE_MODEL_SENTINEL
  }
}

/**
 * 模型选择 Hook
 *
 * 权威解析链：用户手动选择 → 全局默认 → none（unknown 哨兵，不伪造默认模型）。
 */
function isSameSelectionState(
  left: AgentDialogueSelectionState,
  right: AgentDialogueSelectionState
): boolean {
  return (
    left.assistantId === right.assistantId &&
    left.providerId === right.providerId &&
    left.modelId === right.modelId &&
    left.modelSelectionSource === right.modelSelectionSource
  )
}

export function useModelSelection(params: UseModelSelectionParams): UseModelSelectionResult {
  const { sessionId, currentAssistant } = params
  const globalModels = useSettingsStore((s) => s.globalModels)
  const providers = useSettingsStore((s: { providers?: AIProviderConfig[] }) => s.providers)
  const globalDialogueProviderId = globalModels?.globalDialogueProviderId
  const globalDialogueModelId = globalModels?.globalDialogueModelId

  const assistantId = currentAssistant?.id != null ? String(currentAssistant.id) : undefined

  const [currentProviderId, setCurrentProviderId] = useState<string>(
    UNCONFIGURED_DIALOGUE_MODEL_SENTINEL
  )
  const [currentModelId, setCurrentModelId] = useState<string>(UNCONFIGURED_DIALOGUE_MODEL_SENTINEL)
  const [modelSelectionSource, setModelSelectionSource] =
    useState<DialogueModelSelectionSource>('none')
  const [selectionState, setSelectionState] = useState<AgentDialogueSelectionState>(() =>
    buildAgentDialogueSelectionState({
      assistantId,
      resolved: { providerId: null, modelId: null, source: 'none' }
    })
  )
  const [lastSelectionSwitch, setLastSelectionSwitch] =
    useState<AgentDialogueSelectionSwitchEvent | null>(null)

  const userManuallySetModelRef = useRef<boolean>(false)
  const prevSessionIdRef = useRef<string | null>(null)
  const selectionStateRef = useRef<AgentDialogueSelectionState>(selectionState)
  const currentIdsRef = useRef({ providerId: currentProviderId, modelId: currentModelId })
  currentIdsRef.current = { providerId: currentProviderId, modelId: currentModelId }

  const commitResolved = useCallback(
    (resolved: ReturnType<typeof resolveDialogueModelSelection>) => {
      const next = buildAgentDialogueSelectionState({ assistantId, resolved })
      const previous = selectionStateRef.current
      if (isSameSelectionState(previous, next)) return
      const switches = detectDialogueSelectionSwitches(previous, next, sessionId)
      selectionStateRef.current = next
      setSelectionState(next)
      setModelSelectionSource(resolved.source)
      if (switches.length > 0) {
        setLastSelectionSwitch(switches[switches.length - 1] ?? null)
      }
    },
    [assistantId, sessionId]
  )

  useEffect(() => {
    const prevSessionId = prevSessionIdRef.current ?? undefined
    const normalizedSessionId = sessionId || null
    if (prevSessionIdRef.current !== normalizedSessionId) {
      const inlineCreatedFromDraft =
        isDraftChatSessionId(prevSessionId) &&
        !isDraftChatSessionId(sessionId) &&
        userManuallySetModelRef.current &&
        isConfiguredProviderId(currentIdsRef.current.providerId) &&
        isConfiguredDialogueModelId(currentIdsRef.current.modelId)
      if (!inlineCreatedFromDraft) {
        userManuallySetModelRef.current = false
      }
      prevSessionIdRef.current = normalizedSessionId
    }

    if (!userManuallySetModelRef.current && sessionId) {
      const initMeta = peekChatInitMeta(sessionId)
      if (
        initMeta &&
        isConfiguredProviderId(initMeta.providerId) &&
        isConfiguredDialogueModelId(initMeta.modelId)
      ) {
        const pid = initMeta.providerId!.trim()
        const mid = initMeta.modelId!.trim()
        userManuallySetModelRef.current = true
        setCurrentProviderId(pid)
        setCurrentModelId(mid)
        commitResolved(
          resolveDialogueModelSelection({
            requestedProviderId: pid,
            requestedModelId: mid,
            globalDialogueProviderId,
            globalDialogueModelId
          })
        )
        return
      }
    }

    if (userManuallySetModelRef.current) return

    const resolved = resolveDialogueModelSelection({
      globalDialogueProviderId,
      globalDialogueModelId
    })
    const ui = applyResolvedToUi(resolved)
    setCurrentProviderId(ui.providerId)
    setCurrentModelId(ui.modelId)
    commitResolved(resolved)

    if (
      !sessionId ||
      isDraftChatSessionId(sessionId) ||
      typeof window === 'undefined' ||
      !window.electron?.ipcRenderer?.invoke
    ) {
      return
    }

    let cancelled = false
    Promise.resolve(window.electron.ipcRenderer.invoke('agent:get-session', sessionId))
      .then((doc: { providerId?: string | null; modelId?: string | null } | null | undefined) => {
        if (cancelled || userManuallySetModelRef.current) return
        if (
          !isConfiguredProviderId(doc?.providerId) ||
          !isConfiguredDialogueModelId(doc?.modelId)
        ) {
          return
        }
        const pid = doc!.providerId!.trim()
        const mid = doc!.modelId!.trim()
        if (
          Array.isArray(providers) &&
          providers.length > 0 &&
          !providers.some((p) => p.id === pid && p.isEnabled !== false)
        ) {
          return
        }
        userManuallySetModelRef.current = true
        setCurrentProviderId(pid)
        setCurrentModelId(mid)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [sessionId, globalDialogueProviderId, globalDialogueModelId, providers, commitResolved])

  useEffect(() => {
    if (!userManuallySetModelRef.current) return

    const resolved = resolveDialogueModelSelection({
      requestedProviderId: currentProviderId,
      requestedModelId: currentModelId,
      globalDialogueProviderId,
      globalDialogueModelId
    })
    commitResolved(resolved)
  }, [
    currentProviderId,
    currentModelId,
    globalDialogueProviderId,
    globalDialogueModelId,
    commitResolved
  ])

  const setRequestedProviderId = useCallback((id: string) => {
    userManuallySetModelRef.current = true
    setCurrentProviderId(id)
  }, [])

  const setRequestedModelId = useCallback((id: string) => {
    userManuallySetModelRef.current = true
    setCurrentModelId(id)
  }, [])

  const selectDialogueModel = useCallback(
    async (providerId: string, modelId: string) => {
      userManuallySetModelRef.current = true
      setCurrentProviderId(providerId)
      setCurrentModelId(modelId)
      if (
        sessionId &&
        !isDraftChatSessionId(sessionId) &&
        isConfiguredProviderId(providerId) &&
        isConfiguredDialogueModelId(modelId) &&
        typeof window !== 'undefined' &&
        window.electron?.ipcRenderer?.invoke
      ) {
        try {
          await window.electron.ipcRenderer.invoke(
            'agent:update-session-dialogue-model',
            sessionId,
            providerId,
            modelId
          )
        } catch {
          // ignore persistence failure in UI
        }
      }
    },
    [sessionId]
  )

  return {
    currentProviderId,
    currentModelId,
    modelSelectionSource,
    selectionState,
    lastSelectionSwitch,
    setCurrentProviderId: setRequestedProviderId,
    setCurrentModelId: setRequestedModelId,
    selectDialogueModel,
    userManuallySetModelRef
  }
}
