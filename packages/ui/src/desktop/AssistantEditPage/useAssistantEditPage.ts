import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_ASSISTANT_KIND,
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
  isAssistantCustomAvatar,
  normalizeAssistantAvatarPath,
  normalizeAssistantKind,
  type AssistantKind
} from '@baishou/shared'
import { logger } from '@baishou/shared'
import type { AssistantFormData } from './assistant-edit.types'

interface UseAssistantEditPageOptions {
  assistant: AssistantFormData | null
  onSave: (data: AssistantFormData) => void
}

export function useAssistantEditPage({ assistant, onSave }: UseAssistantEditPageOptions) {
  const { t } = useTranslation()
  const isEditing = assistant !== null

  const [name, setName] = useState(assistant?.name ?? '')
  const [description, setDescription] = useState(assistant?.description ?? '')
  const [systemPrompt, setSystemPrompt] = useState(assistant?.systemPrompt ?? '')
  const [assistantKind, setAssistantKind] = useState<AssistantKind>(
    normalizeAssistantKind(assistant?.assistantKind ?? DEFAULT_ASSISTANT_KIND)
  )
  const [contextWindow, setContextWindow] = useState(assistant?.contextWindow ?? -1)
  const [providerId, setProviderId] = useState(assistant?.providerId)
  const [modelId, setModelId] = useState(assistant?.modelId)
  const [compressThreshold, setCompressThreshold] = useState(
    assistant?.compressTokenThreshold ?? 60000
  )
  const [compressKeepTurns, setCompressKeepTurns] = useState(assistant?.compressKeepTurns ?? 3)
  const [avatarPath, setAvatarPath] = useState(
    normalizeAssistantAvatarPath(assistant?.avatarPath) || DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
  )
  const [saving, setSaving] = useState(false)
  const [providerPickerOpen, setProviderPickerOpen] = useState(false)
  const [pickerProviders, setPickerProviders] = useState<any[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCompressTooltip, setShowCompressTooltip] = useState(false)
  const [showKeepTurnsTooltip, setShowKeepTurnsTooltip] = useState(false)

  const isUnlimitedContext = contextWindow < 0
  const isCompressDisabled = compressThreshold <= 0
  const showResetBuiltin = isAssistantCustomAvatar(avatarPath)

  useEffect(() => {
    if (!assistant) return
    setName(assistant.name ?? '')
    setDescription(assistant.description ?? '')
    setSystemPrompt(assistant.systemPrompt ?? '')
    setContextWindow(assistant.contextWindow ?? -1)
    setProviderId(assistant.providerId)
    setModelId(assistant.modelId)
    setCompressThreshold(assistant.compressTokenThreshold ?? 60000)
    setCompressKeepTurns(assistant.compressKeepTurns ?? 3)
    setAvatarPath(
      normalizeAssistantAvatarPath(assistant.avatarPath) || DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
    )
    setAssistantKind(normalizeAssistantKind(assistant.assistantKind))
  }, [assistant])

  const handleKindChange = (kind: AssistantKind) => {
    setAssistantKind(kind)
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electron) {
      ;(window as any).electron.ipcRenderer
        .invoke('agent:get-providers')
        .then((list: any) => {
          setPickerProviders((list || []).filter((p: any) => p.isEnabled))
        })
        .catch(console.error)
    }
  }, [])

  const handleSave = () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      onSave({
        id: assistant?.id ?? crypto.randomUUID(),
        name: name.trim(),
        emoji: '',
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        contextWindow: isUnlimitedContext ? -1 : Math.round(contextWindow),
        providerId: providerId ?? undefined,
        modelId: modelId ?? undefined,
        compressTokenThreshold: isCompressDisabled ? 0 : Math.round(compressThreshold),
        compressKeepTurns: Math.round(compressKeepTurns),
        avatarPath: normalizeAssistantAvatarPath(avatarPath),
        assistantKind
      })
    } catch (e) {
      logger.error('Failed to save assistant:', e)
    } finally {
      setTimeout(() => setSaving(false), 500)
    }
  }

  const clearModelBinding = () => {
    setProviderId(undefined)
    setModelId(undefined)
  }

  return {
    isEditing,
    name,
    setName,
    description,
    setDescription,
    systemPrompt,
    setSystemPrompt,
    contextWindow,
    setContextWindow,
    providerId,
    modelId,
    compressThreshold,
    setCompressThreshold,
    compressKeepTurns,
    setCompressKeepTurns,
    avatarPath,
    setAvatarPath,
    saving,
    providerPickerOpen,
    setProviderPickerOpen,
    pickerProviders,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showCompressTooltip,
    setShowCompressTooltip,
    showKeepTurnsTooltip,
    setShowKeepTurnsTooltip,
    isUnlimitedContext,
    isCompressDisabled,
    showResetBuiltin,
    handleSave,
    clearModelBinding,
    setProviderId,
    setModelId,
    assistantKind,
    handleKindChange
  }
}
