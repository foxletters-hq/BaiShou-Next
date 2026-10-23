import { useCallback, useEffect, useMemo, useState } from 'react'
import { useReasoningCatalogEpoch } from '@baishou/ui'
import {
  getReasoningControlForModel,
  normalizeReasoningEffortSetting,
  resolveDialogueEffortPreference,
  type ReasoningEffortSetting
} from '@baishou/shared'
import {
  getReasoningEffortForModel,
  setReasoningEffortForModel,
  setSessionReasoningEffortOverride
} from '../../agent/reasoning-effort-session'
import {
  buildModelReasoningPreviewMap,
  formatReasoningControlPreview
} from '../../agent/format-reasoning-control-preview'
import { useDialogueSlotEffort } from '../../agent/use-dialogue-slot-effort'
import type { useAgentWorkspaceChrome } from './useAgentWorkspaceChrome'

type WorkspaceChrome = ReturnType<typeof useAgentWorkspaceChrome>

export function useAgentWorkspaceReasoningChrome(chrome: WorkspaceChrome) {
  const dialogueSlotEffort = useDialogueSlotEffort()
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortSetting>(() =>
    resolveDialogueEffortPreference(
      getReasoningEffortForModel(chrome.model.currentProviderId, chrome.model.currentModelId),
      dialogueSlotEffort
    )
  )
  const [reasoningPreviewTick, setReasoningPreviewTick] = useState(0)
  const [modelMenuAnchor, setModelMenuAnchor] = useState<DOMRect | null>(null)

  const reasoningProviderType = useMemo(() => {
    const providerId = chrome.model.currentProviderId
    const provider = chrome.providers.find((item) => item.id === providerId)
    return provider?.type || providerId || undefined
  }, [chrome.model.currentProviderId, chrome.providers])

  const reasoningCatalogEpoch = useReasoningCatalogEpoch()
  const reasoningControl = useMemo(() => {
    // 目录热更新只改模块表、不改 modelId；引用 epoch 才能按新表重算
    void reasoningCatalogEpoch
    return getReasoningControlForModel(chrome.model.currentModelId || '', reasoningProviderType)
  }, [chrome.model.currentModelId, reasoningProviderType, reasoningCatalogEpoch])

  useEffect(() => {
    const next = resolveDialogueEffortPreference(
      getReasoningEffortForModel(chrome.model.currentProviderId, chrome.model.currentModelId),
      dialogueSlotEffort
    )
    setReasoningEffort(next)
    setSessionReasoningEffortOverride(next)
  }, [chrome.model.currentProviderId, chrome.model.currentModelId, dialogueSlotEffort])

  const handleReasoningEffortChange = useCallback(
    (value: ReasoningEffortSetting) => {
      const normalized = normalizeReasoningEffortSetting(value)
      setReasoningEffort(normalized)
      setSessionReasoningEffortOverride(normalized)
      if (chrome.model.currentProviderId && chrome.model.currentModelId) {
        setReasoningEffortForModel(
          chrome.model.currentProviderId,
          chrome.model.currentModelId,
          normalized
        )
        setReasoningPreviewTick((n) => n + 1)
      }
    },
    [chrome.model.currentProviderId, chrome.model.currentModelId]
  )

  const modelReasoningPreviews = useMemo(
    () => buildModelReasoningPreviewMap(chrome.providers),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick refreshes after persist
    [chrome.providers, reasoningPreviewTick, chrome.showModelSwitcher]
  )

  const effortSuffix = formatReasoningControlPreview({
    modelId: chrome.model.currentModelId,
    providerTypeOrId: reasoningProviderType,
    effort: reasoningEffort
  })

  const openModelSwitcher = useCallback(
    (anchorRect?: DOMRect | null) => {
      setModelMenuAnchor(anchorRect ?? null)
      chrome.setShowModelSwitcher(true)
    },
    [chrome]
  )

  return {
    reasoningEffort,
    reasoningControl,
    modelReasoningPreviews,
    effortSuffix,
    modelMenuAnchor,
    handleReasoningEffortChange,
    openModelSwitcher
  }
}
