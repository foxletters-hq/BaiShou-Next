import { useState, useRef, useEffect, useCallback } from 'react'
import { useSettingsStore } from '@baishou/store'
import {
  buildAgentDialogueSelectionState,
  detectDialogueSelectionSwitches,
  resolveDialogueModelSelection,
  type AgentDialogueSelectionState,
  type AgentDialogueSelectionSwitchEvent,
  type DialogueModelSelectionSource,
  UNCONFIGURED_DIALOGUE_MODEL_SENTINEL
} from '@baishou/shared'

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
 * 权威解析链：伙伴 → 用户手动选择 → 全局默认 → none（unknown 哨兵，不伪造默认模型）。
 */
export function useModelSelection(params: UseModelSelectionParams): UseModelSelectionResult {
  const { sessionId, currentAssistant } = params
  const settings = useSettingsStore()

  const assistantId =
    currentAssistant?.id != null ? String(currentAssistant.id) : undefined

  const [currentProviderId, setCurrentProviderId] = useState<string>(
    UNCONFIGURED_DIALOGUE_MODEL_SENTINEL
  )
  const [currentModelId, setCurrentModelId] = useState<string>(
    UNCONFIGURED_DIALOGUE_MODEL_SENTINEL
  )
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

  const commitResolved = useCallback(
    (resolved: ReturnType<typeof resolveDialogueModelSelection>) => {
      const next = buildAgentDialogueSelectionState({ assistantId, resolved })
      const switches = detectDialogueSelectionSwitches(selectionStateRef.current, next, sessionId)
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
    if (prevSessionIdRef.current !== sessionId) {
      userManuallySetModelRef.current = false
      prevSessionIdRef.current = sessionId || null
    }

    if (userManuallySetModelRef.current) return

    const resolved = resolveDialogueModelSelection({
      assistantProviderId: currentAssistant?.providerId,
      assistantModelId: currentAssistant?.modelId,
      globalDialogueProviderId: settings.globalModels?.globalDialogueProviderId,
      globalDialogueModelId: settings.globalModels?.globalDialogueModelId
    })
    const ui = applyResolvedToUi(resolved)
    setCurrentProviderId(ui.providerId)
    setCurrentModelId(ui.modelId)
    commitResolved(resolved)
  }, [sessionId, currentAssistant, settings.globalModels, assistantId, commitResolved])

  useEffect(() => {
    if (!userManuallySetModelRef.current) return

    const resolved = resolveDialogueModelSelection({
      assistantProviderId: currentAssistant?.providerId,
      assistantModelId: currentAssistant?.modelId,
      requestedProviderId: currentProviderId,
      requestedModelId: currentModelId,
      globalDialogueProviderId: settings.globalModels?.globalDialogueProviderId,
      globalDialogueModelId: settings.globalModels?.globalDialogueModelId
    })
    commitResolved(resolved)
  }, [
    currentProviderId,
    currentModelId,
    currentAssistant,
    settings.globalModels,
    assistantId,
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

  return {
    currentProviderId,
    currentModelId,
    modelSelectionSource,
    selectionState,
    lastSelectionSwitch,
    setCurrentProviderId: setRequestedProviderId,
    setCurrentModelId: setRequestedModelId,
    userManuallySetModelRef
  }
}
