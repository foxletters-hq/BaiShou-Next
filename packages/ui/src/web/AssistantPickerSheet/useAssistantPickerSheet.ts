import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import type { AssistantInfo, AssistantPickerSheetProps } from './assistant-picker-sheet.types'

export function useAssistantPickerSheet({
  isOpen,
  assistants,
  currentAssistantId,
  onRefreshAssistants,
  pinnedIds,
  onTogglePin
}: AssistantPickerSheetProps) {
  const { t } = useTranslation()
  const { prompt } = useDialog()
  const [searchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(
    currentAssistantId || (assistants.length > 0 ? assistants[0].id : null)
  )
  const [activeTab, setActiveTab] = useState<'prompt' | 'memory'>('prompt')
  const [editingPrompt, setEditingPrompt] = useState('')
  const [editingContextWindow, setEditingContextWindow] = useState(-1)
  const [editingCompressEnabled, setEditingCompressEnabled] = useState(true)
  const [editingCompressThreshold, setEditingCompressThreshold] = useState(60000)
  const [editingCompressKeepTurns, setEditingCompressKeepTurns] = useState(3)
  const [isSaving, setIsSaving] = useState(false)
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)
  const [providers, setProviders] = useState<any[]>([])
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  React.useEffect(() => {
    if (isOpen && currentAssistantId) {
      setSelectedId(currentAssistantId)
    }
  }, [isOpen, currentAssistantId])

  React.useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).api?.settings) {
      ;(window as any).api.settings.getProviders().then((res: any) => {
        if (res) setProviders(res)
      })
    }
  }, [])

  const filteredAssistants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return assistants
    return assistants.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q))
    )
  }, [assistants, searchQuery])

  const activeAssistant = useMemo(() => {
    let item = filteredAssistants.find((a) => a.id === selectedId)
    if (!item && filteredAssistants.length > 0) {
      item = filteredAssistants[0]
    }
    return item
  }, [filteredAssistants, selectedId])

  React.useEffect(() => {
    if (activeAssistant) {
      setEditingPrompt(activeAssistant.systemPrompt || '')
      setEditingContextWindow(activeAssistant.contextWindow ?? -1)
      setEditingCompressEnabled(activeAssistant.compressTokenThreshold > 0)
      setEditingCompressThreshold(
        activeAssistant.compressTokenThreshold > 0 ? activeAssistant.compressTokenThreshold : 60000
      )
      setEditingCompressKeepTurns(activeAssistant.compressKeepTurns ?? 3)
    }
  }, [activeAssistant])

  const saveConfig = async (overrides: Partial<Record<string, unknown>> = {}) => {
    if (!activeAssistant) return
    try {
      setIsSaving(true)
      if (typeof window !== 'undefined' && (window as any).electron) {
        await (window as any).electron.ipcRenderer.invoke(
          'agent:update-assistant',
          activeAssistant.id,
          {
            systemPrompt:
              overrides.systemPrompt !== undefined ? overrides.systemPrompt : editingPrompt.trim(),
            contextWindow:
              overrides.contextWindow !== undefined
                ? overrides.contextWindow
                : editingContextWindow,
            compressTokenThreshold:
              overrides.compressTokenThreshold !== undefined
                ? overrides.compressTokenThreshold
                : editingCompressEnabled
                  ? editingCompressThreshold
                  : 0,
            compressKeepTurns:
              overrides.compressKeepTurns !== undefined
                ? overrides.compressKeepTurns
                : editingCompressKeepTurns,
            ...overrides
          }
        )
      }
      onRefreshAssistants?.()
    } finally {
      setIsSaving(false)
    }
  }

  const updateAssistantAPI = async (id: string, updates: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && (window as any).electron) {
      await (window as any).electron.ipcRenderer.invoke('agent:update-assistant', id, updates)
      onRefreshAssistants?.()
    }
  }

  const handleEditName = async () => {
    if (!activeAssistant) return
    const newName = await prompt(
      t('agent.assistant.new_name_prompt', '请输入新的伙伴名称：'),
      activeAssistant.name,
      t('agent.assistant.edit_name_title', '修改伙伴名称'),
      false
    )
    if (newName && newName.trim()) {
      updateAssistantAPI(activeAssistant.id, { name: newName.trim() })
    }
  }

  const confirmDelete = async () => {
    if (deleteTargetId === null) return
    if (typeof window !== 'undefined' && (window as any).electron) {
      await (window as any).electron.ipcRenderer.invoke('agent:delete-assistant', deleteTargetId)
      onRefreshAssistants?.()
      if (deleteTargetId === selectedId && assistants.length > 0) {
        setSelectedId(assistants.find((a) => a.id !== deleteTargetId)?.id || null)
      }
    }
    setDeleteTargetId(null)
  }

  return {
    t,
    filteredAssistants,
    activeAssistant,
    selectedId,
    setSelectedId,
    activeTab,
    setActiveTab,
    editingPrompt,
    setEditingPrompt,
    editingContextWindow,
    setEditingContextWindow,
    editingCompressEnabled,
    setEditingCompressEnabled,
    editingCompressThreshold,
    setEditingCompressThreshold,
    editingCompressKeepTurns,
    setEditingCompressKeepTurns,
    isSaving,
    showModelSwitcher,
    setShowModelSwitcher,
    providers,
    deleteTargetId,
    setDeleteTargetId,
    saveConfig,
    updateAssistantAPI,
    handleEditName,
    confirmDelete,
    pinnedIds,
    onTogglePin,
    assistants
  }
}

export type AssistantPickerSheetViewModel = ReturnType<typeof useAssistantPickerSheet>
