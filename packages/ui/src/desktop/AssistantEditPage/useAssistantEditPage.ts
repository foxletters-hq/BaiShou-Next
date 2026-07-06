import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS,
  DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
  DEFAULT_ASSISTANT_CONTEXT_WINDOW,
  DEFAULT_ASSISTANT_KIND,
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
  isAssistantCustomAvatar,
  normalizeAssistantAvatarPath,
  normalizeAssistantKind,
  normalizeEmojiToolConfig,
  parseAssistantEmojiGroupIds,
  serializeAssistantEmojiGroupIds,
  type AssistantKind,
  type EmojiGroup,
  type EmojiToolConfig,
  logger
} from '@baishou/shared'
import type { AssistantFormData } from './assistant-edit.types'

function resolveFormEmojiGroupIds(assistant: AssistantFormData | null): string[] {
  if (!assistant) return []
  if (Array.isArray(assistant.emojiGroupIds)) {
    return assistant.emojiGroupIds
  }
  const raw = assistant.emojiGroupIds as unknown
  if (typeof raw === 'string') {
    return parseAssistantEmojiGroupIds(raw, assistant.emojiGroupId)
  }
  return parseAssistantEmojiGroupIds(null, assistant.emojiGroupId)
}

function buildEmojiPersistFields(ids: string[], enabled: boolean) {
  const serialized = serializeAssistantEmojiGroupIds(ids)
  return {
    emojiEnabled: enabled,
    emojiGroupIds: serialized,
    emojiGroupId: ids[0] ?? null
  } as Partial<AssistantFormData>
}

interface UseAssistantEditPageOptions {
  assistant: AssistantFormData | null
  onSave: (data: AssistantFormData) => void
  /** 编辑已有伙伴时，滑动条等字段松手后立即落库（不关闭页面） */
  onPatchSave?: (id: string, patch: Partial<AssistantFormData>) => void | Promise<void>
}

export function useAssistantEditPage({
  assistant,
  onSave,
  onPatchSave
}: UseAssistantEditPageOptions) {
  const { t } = useTranslation()
  const isEditing = assistant !== null

  const [name, setName] = useState(assistant?.name ?? '')
  const [description, setDescription] = useState(assistant?.description ?? '')
  const [systemPrompt, setSystemPrompt] = useState(assistant?.systemPrompt ?? '')
  const [assistantKind, setAssistantKind] = useState<AssistantKind>(
    normalizeAssistantKind(assistant?.assistantKind ?? DEFAULT_ASSISTANT_KIND)
  )
  const [contextWindow, setContextWindow] = useState(
    assistant?.contextWindow ?? DEFAULT_ASSISTANT_CONTEXT_WINDOW
  )
  const [providerId, setProviderId] = useState(assistant?.providerId)
  const [modelId, setModelId] = useState(assistant?.modelId)
  const [compressThreshold, setCompressThreshold] = useState(
    assistant?.compressTokenThreshold ?? DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD
  )
  const [compressKeepTurns, setCompressKeepTurns] = useState(
    assistant?.compressKeepTurns ?? DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS
  )
  const [avatarPath, setAvatarPath] = useState(
    normalizeAssistantAvatarPath(assistant?.avatarPath) || DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
  )
  const [saving, setSaving] = useState(false)
  const [providerPickerOpen, setProviderPickerOpen] = useState(false)
  const [pickerProviders, setPickerProviders] = useState<any[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [emojiGroups, setEmojiGroups] = useState<EmojiGroup[]>([])
  const [globalEmojiEnabled, setGlobalEmojiEnabled] = useState(false)
  const [emojiEnabled, setEmojiEnabled] = useState(assistant?.emojiEnabled === true)
  const [selectedEmojiGroupIds, setSelectedEmojiGroupIds] = useState<string[]>(() =>
    resolveFormEmojiGroupIds(assistant)
  )

  const isUnlimitedContext = contextWindow < 0
  const isCompressDisabled = compressThreshold <= 0
  const showResetBuiltin = isAssistantCustomAvatar(avatarPath)

  useEffect(() => {
    if (!assistant) return
    setName(assistant.name ?? '')
    setDescription(assistant.description ?? '')
    setSystemPrompt(assistant.systemPrompt ?? '')
    setContextWindow(assistant.contextWindow ?? DEFAULT_ASSISTANT_CONTEXT_WINDOW)
    setProviderId(assistant.providerId)
    setModelId(assistant.modelId)
    setCompressThreshold(
      assistant.compressTokenThreshold ?? DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD
    )
    setCompressKeepTurns(assistant.compressKeepTurns ?? DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS)
    setAvatarPath(
      normalizeAssistantAvatarPath(assistant.avatarPath) || DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
    )
    setAssistantKind(normalizeAssistantKind(assistant.assistantKind))
    setEmojiEnabled(assistant.emojiEnabled === true)
    setSelectedEmojiGroupIds(resolveFormEmojiGroupIds(assistant))
  }, [assistant])

  useEffect(() => {
    const loadEmojiConfig = () => {
      const api = (window as any).api
      if (!api?.settings?.getToolManagementConfig) return
      void api.settings
        .getToolManagementConfig()
        .then((config: { emojiConfig?: EmojiToolConfig | null }) => {
          const normalized = normalizeEmojiToolConfig(config?.emojiConfig)
          setGlobalEmojiEnabled(normalized.enabled === true)
          setEmojiGroups(normalized.groups)
        })
        .catch(() => setEmojiGroups([]))
    }

    loadEmojiConfig()
    window.addEventListener('focus', loadEmojiConfig)
    return () => window.removeEventListener('focus', loadEmojiConfig)
  }, [])

  const handleKindChange = (kind: AssistantKind) => {
    setAssistantKind(kind)
  }

  const patchAssistantField = (patch: Partial<AssistantFormData>) => {
    if (!isEditing || !assistant?.id || !onPatchSave) return
    void onPatchSave(assistant.id, patch)
  }

  const commitContextWindow = (value: number) => {
    setContextWindow(value)
    patchAssistantField({ contextWindow: value < 0 ? -1 : Math.round(value) })
  }

  const commitCompressThreshold = (value: number) => {
    setCompressThreshold(value)
    patchAssistantField({
      compressTokenThreshold: value <= 0 ? 0 : Math.round(value)
    })
  }

  const commitCompressKeepTurns = (value: number) => {
    setCompressKeepTurns(value)
    patchAssistantField({ compressKeepTurns: Math.round(value) })
  }

  const handleToggleCompress = (enabled: boolean) => {
    const next = enabled
      ? compressThreshold > 0
        ? compressThreshold
        : DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD
      : 0
    setCompressThreshold(next)
    patchAssistantField({
      compressTokenThreshold: enabled
        ? Math.round(next || DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD)
        : 0
    })
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
        assistantKind,
        ...buildEmojiPersistFields(selectedEmojiGroupIds, emojiEnabled)
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
    isUnlimitedContext,
    isCompressDisabled,
    showResetBuiltin,
    handleSave,
    clearModelBinding,
    setProviderId,
    setModelId,
    assistantKind,
    handleKindChange,
    commitContextWindow,
    commitCompressThreshold,
    commitCompressKeepTurns,
    handleToggleCompress,
    emojiGroups,
    emojiEnabled,
    selectedEmojiGroupIds,
    globalEmojiEnabled,
    setEmojiEnabled: (value: boolean) => {
      setEmojiEnabled(value)
      patchAssistantField(buildEmojiPersistFields(selectedEmojiGroupIds, value))
    },
    toggleEmojiGroup: (groupId: string) => {
      setSelectedEmojiGroupIds((prev) => {
        const next = prev.includes(groupId)
          ? prev.filter((id) => id !== groupId)
          : [...prev, groupId]
        patchAssistantField(buildEmojiPersistFields(next, emojiEnabled))
        return next
      })
    }
  }
}
