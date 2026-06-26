import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@baishou/ui'
import { useAssistantStore, useSettingsStore } from '@baishou/store'
import { useTokenUsage } from '../../agent/hooks/useTokenUsage'
import { useModelSelection } from '../../agent/hooks/useModelSelection'

const SELECTED_ASSISTANT_STORAGE_KEY = 'agent_workspace_selected_assistant_id'

function readStoredAssistantId(): string | undefined {
  try {
    return localStorage.getItem(SELECTED_ASSISTANT_STORAGE_KEY) || undefined
  } catch {
    return undefined
  }
}

function writeStoredAssistantId(assistantId: string | undefined): void {
  try {
    if (!assistantId) localStorage.removeItem(SELECTED_ASSISTANT_STORAGE_KEY)
    else localStorage.setItem(SELECTED_ASSISTANT_STORAGE_KEY, assistantId)
  } catch {
    /* ignore */
  }
}

export function useAgentWorkspaceChrome(sessionId?: string) {
  const { t } = useTranslation()
  const { assistants, fetchAssistants } = useAssistantStore()
  const settings = useSettingsStore()
  const providers = settings?.providers || []

  const [selectedAssistantId, setSelectedAssistantId] = useState<string | undefined>(
    readStoredAssistantId
  )
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)
  const [showCostDialog, setShowCostDialog] = useState(false)
  const [showAssistantPicker, setShowAssistantPicker] = useState(false)
  const [pricingLastUpdated, setPricingLastUpdated] = useState<Date | null>(null)
  const pricingBootWarnShownRef = useRef(false)

  const defaultAssistant =
    assistants.find((a) => a.isDefault) ?? assistants[0] ?? undefined

  const currentAssistant = useMemo(() => {
    const id = selectedAssistantId ?? defaultAssistant?.id
    if (id == null) return undefined
    return assistants.find((a) => String(a.id) === String(id)) ?? defaultAssistant
  }, [assistants, defaultAssistant, selectedAssistantId])

  const model = useModelSelection({ sessionId, currentAssistant })
  const tokens = useTokenUsage(sessionId, false)

  useEffect(() => {
    if (assistants.length === 0) {
      void fetchAssistants()
    }
  }, [assistants.length, fetchAssistants])

  useEffect(() => {
    if (!sessionId || typeof window === 'undefined' || !window.electron) return
    void window.electron.ipcRenderer
      .invoke('agent:get-session', sessionId)
      .then((doc) => {
        const assistantId = doc?.assistantId
        if (typeof assistantId === 'string' && assistantId) {
          setSelectedAssistantId(assistantId)
          writeStoredAssistantId(assistantId)
        }
      })
      .catch(() => undefined)
  }, [sessionId])

  useEffect(() => {
    if (!selectedAssistantId && defaultAssistant?.id != null) {
      const id = String(defaultAssistant.id)
      setSelectedAssistantId(id)
      writeStoredAssistantId(id)
    }
  }, [defaultAssistant?.id, selectedAssistantId])

  const fetchPricingLastUpdated = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electron) return
    try {
      const status = await window.electron.ipcRenderer.invoke('pricing:get-status')
      if (status?.lastUpdated) {
        setPricingLastUpdated(new Date(status.lastUpdated))
      }
      const pricingUnavailable =
        status?.loadFailed || status?.hasPrices === false || !status?.lastUpdated
      if (pricingUnavailable && !pricingBootWarnShownRef.current) {
        pricingBootWarnShownRef.current = true
        toast.showWarning(
          t('agent.pricing_unavailable', '计费数据暂不可用，费用显示可能不准确。')
        )
      }
    } catch {
      /* ignore */
    }
  }, [t])

  useEffect(() => {
    void fetchPricingLastUpdated()
  }, [fetchPricingLastUpdated])

  const handleRefreshPricing = useCallback(async () => {
    if (typeof window === 'undefined' || !window.electron) {
      return { success: false, error: 'unavailable' }
    }
    try {
      await window.electron.ipcRenderer.invoke('pricing:refresh')
      await fetchPricingLastUpdated()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }, [fetchPricingLastUpdated])

  const handleAssistantSelected = useCallback(
    (assistant: { id: string }) => {
      const id = String(assistant.id)
      setSelectedAssistantId(id)
      writeStoredAssistantId(id)
      model.userManuallySetModelRef.current = false
      setShowAssistantPicker(false)
    },
    [model.userManuallySetModelRef]
  )

  const pinnedIds = assistants.filter((a: { isPinned?: boolean }) => a.isPinned).map((a) => String(a.id))

  return {
    t,
    providers,
    assistants,
    fetchAssistants,
    currentAssistant,
    selectedAssistantId: currentAssistant?.id != null ? String(currentAssistant.id) : undefined,
    model,
    tokens,
    showModelSwitcher,
    setShowModelSwitcher,
    showCostDialog,
    setShowCostDialog,
    showAssistantPicker,
    setShowAssistantPicker,
    pricingLastUpdated,
    handleRefreshPricing,
    handleAssistantSelected,
    pinnedIds
  }
}
