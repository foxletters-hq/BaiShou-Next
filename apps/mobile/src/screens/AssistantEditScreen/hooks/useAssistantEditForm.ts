import { useState, useEffect, useCallback } from 'react'
import { Keyboard } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useNativeTheme, useNativeToast, useDialog } from '@baishou/ui/native'
import {
  AIProviderConfig,
  DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS,
  DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD,
  DEFAULT_ASSISTANT_CONTEXT_WINDOW,
  DEFAULT_ASSISTANT_KIND,
  DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH,
  isDefaultAssistantAvatarPath,
  normalizePersistedAvatarPath,
  normalizeAssistantKind,
  getDefaultCompressionSystemPrompt,
  isAssistantAvatarRelativePath,
  filterProvidersForModelSwitcher,
  normalizeEmojiToolConfig,
  serializeAssistantEmojiGroupIds,
  type AssistantKind,
  type EmojiGroup,
  type ModelSwitcherProvider,
  type ToolManagementConfig
} from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  buildAssistantRepoInput,
  findAssistantForUi,
  listAssistantsForUi
} from '../../../lib/mobile-assistant.util'
import {
  isResolvableAssistantAvatarDirectUri,
  normalizeAssistantAvatarDisplayUri
} from '../../../lib/assistant-avatar-uri'
import { resolveAssistantAvatarForMobileUi } from '../../../lib/assistant-avatar-display.util'
import { markAssistantsNeedRefresh } from '../../../lib/assistant-ui-refresh-signal'
import { launchAvatarImageLibraryAsync, requestAvatarLibraryPermission } from '@baishou/ui/native'
import type { Assistant } from '../assistant-edit-format.util'

export function useAssistantEditForm() {
  const { t, i18n } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const insets = useSafeAreaInsets()

  const isNew = !id || id === 'new'

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [assistantKind, setAssistantKind] = useState<AssistantKind>(DEFAULT_ASSISTANT_KIND)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [providerId, setProviderId] = useState<string | undefined>()
  const [modelId, setModelId] = useState<string | undefined>()
  const [storedAvatarPath, setStoredAvatarPath] = useState<string>(
    DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
  )
  const [previewAvatarUri, setPreviewAvatarUri] = useState<string | null>(null)
  const [pendingImportUri, setPendingImportUri] = useState<string | null>(null)
  const [contextWindow, setContextWindow] = useState(DEFAULT_ASSISTANT_CONTEXT_WINDOW)
  const [compressTokenThreshold, setCompressTokenThreshold] = useState(
    DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD
  )
  const [compressKeepTurns, setCompressKeepTurns] = useState(DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS)
  const [compressSystemPrompt, setCompressSystemPrompt] = useState(() =>
    getDefaultCompressionSystemPrompt()
  )
  const [existingAssistant, setExistingAssistant] = useState<Assistant | null>(null)
  const [chatProviders, setChatProviders] = useState<ModelSwitcherProvider[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)
  const [outerScrollEnabled, setOuterScrollEnabled] = useState(true)
  const [emojiGroups, setEmojiGroups] = useState<EmojiGroup[]>([])
  const [globalEmojiEnabled, setGlobalEmojiEnabled] = useState(false)
  const [emojiEnabled, setEmojiEnabled] = useState(false)
  const [selectedEmojiGroupIds, setSelectedEmojiGroupIds] = useState<string[]>([])

  const isUnlimitedContext = contextWindow < 0
  const isCompressDisabled = compressTokenThreshold <= 0

  const handleKindChange = useCallback((kind: AssistantKind) => {
    setAssistantKind(kind)
  }, [])

  const resolveAvatarPreview = useCallback(
    async (path?: string) => {
      if (isDefaultAssistantAvatarPath(path)) {
        setPreviewAvatarUri(null)
        return
      }
      if (!path) {
        setPreviewAvatarUri(null)
        return
      }
      if (isResolvableAssistantAvatarDirectUri(path)) {
        setPreviewAvatarUri(normalizeAssistantAvatarDisplayUri(path))
        return
      }
      if (isAssistantAvatarRelativePath(path) && services) {
        try {
          const displayUri = await resolveAssistantAvatarForMobileUi(
            path,
            services.attachmentManager,
            services.fileSystem,
            { preferFileUri: false }
          )
          setPreviewAvatarUri(displayUri ?? null)
        } catch {
          setPreviewAvatarUri(null)
        }
        return
      }
      setPreviewAvatarUri(null)
    },
    [services]
  )

  useEffect(() => {
    if (!dbReady || !services) return
    services.settingsManager
      .get<AIProviderConfig[]>('ai_providers')
      .then((list) => setChatProviders(filterProvidersForModelSwitcher(list || [], 'dialogue')))
      .catch(() => setChatProviders([]))
  }, [dbReady, services])

  useEffect(() => {
    if (!dbReady || !services) return
    void services.settingsManager
      .get<ToolManagementConfig>('tool_management_config')
      .then((config) => {
        const normalized = normalizeEmojiToolConfig(config?.emojiConfig)
        setGlobalEmojiEnabled(normalized.enabled === true)
        setEmojiGroups(normalized.groups)
      })
      .catch(() => setEmojiGroups([]))
  }, [dbReady, services])

  useEffect(() => {
    if (isNew || !dbReady || !services) return

    const loadAssistant = async () => {
      try {
        const assistant = await findAssistantForUi(
          services.assistantManager,
          services.attachmentManager,
          services.fileSystem,
          id as string,
          { preferFileUri: false }
        )
        if (assistant) {
          setExistingAssistant(assistant as Assistant)
          setName(assistant.name)
          setDescription(assistant.description || '')
          setSystemPrompt(assistant.systemPrompt || '')
          setProviderId(assistant.providerId)
          setModelId(assistant.modelId)
          setStoredAvatarPath(
            normalizePersistedAvatarPath(assistant.avatarPath) ||
              DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
          )
          setPendingImportUri(null)
          if (assistant.displayAvatarUri) {
            setPreviewAvatarUri(assistant.displayAvatarUri)
          } else {
            await resolveAvatarPreview(assistant.avatarPath ?? undefined)
          }
          setContextWindow(assistant.contextWindow ?? DEFAULT_ASSISTANT_CONTEXT_WINDOW)
          setCompressTokenThreshold(
            assistant.compressTokenThreshold ?? DEFAULT_ASSISTANT_COMPRESS_TOKEN_THRESHOLD
          )
          setCompressKeepTurns(assistant.compressKeepTurns ?? DEFAULT_ASSISTANT_COMPRESS_KEEP_TURNS)
          setCompressSystemPrompt(
            assistant.compressSystemPrompt?.trim() ||
              getDefaultCompressionSystemPrompt(i18n.language)
          )
          setAssistantKind(normalizeAssistantKind(assistant.assistantKind))
          setEmojiEnabled(assistant.emojiEnabled === true)
          setSelectedEmojiGroupIds(assistant.emojiGroupIds ?? [])
        } else {
          toast.showError(t('agent.assistant.not_found'))
          router.back()
        }
      } catch (e) {
        console.error('Failed to load assistant', e)
      } finally {
        setLoading(false)
      }
    }

    void loadAssistant()
  }, [id, isNew, dbReady, services, router, t, toast, resolveAvatarPreview, i18n.language])

  const handlePickImage = useCallback(async () => {
    try {
      if (!(await requestAvatarLibraryPermission())) {
        toast.showError(t('profile.image_pick_permission', '需要相册权限才能选择图片'))
        return
      }

      const result = await launchAvatarImageLibraryAsync()
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri
        setPendingImportUri(uri)
        setPreviewAvatarUri(uri)
        setStoredAvatarPath(uri)
      }
    } catch {
      toast.showError(t('profile.image_pick_error', '选择图片失败'))
    }
  }, [t, toast])

  const handleSelectBuiltin = useCallback((path: string) => {
    setPendingImportUri(null)
    setPreviewAvatarUri(null)
    setStoredAvatarPath(path)
  }, [])

  const clearModelBinding = useCallback(() => {
    setProviderId(undefined)
    setModelId(undefined)
  }, [])

  const openModelSwitcher = useCallback(async () => {
    if (chatProviders.length === 0) {
      toast.showError(t('settings.no_models_available', '暂无可用模型，请先在 AI 服务中配置'))
      return
    }
    setShowModelSwitcher(true)
  }, [chatProviders.length, t, toast])

  const persistMemoryConfig = useCallback(
    async (updates: {
      contextWindow?: number
      compressTokenThreshold?: number
      compressKeepTurns?: number
      compressSystemPrompt?: string | null
      emojiEnabled?: boolean
      emojiGroupIds?: string[]
    }) => {
      if (isNew || !services || !id) return
      try {
        const patch: Record<string, unknown> = { ...updates }
        if (updates.emojiGroupIds !== undefined) {
          patch.emojiGroupIds = serializeAssistantEmojiGroupIds(updates.emojiGroupIds)
        }
        await services.assistantManager.update(id as string, patch)
        markAssistantsNeedRefresh()
      } catch (e) {
        console.error('Failed to persist assistant memory config', e)
      }
    },
    [id, isNew, services]
  )

  const handleToggleEmojiGroup = useCallback(
    (groupId: string) => {
      setSelectedEmojiGroupIds((prev) => {
        const next = prev.includes(groupId)
          ? prev.filter((item) => item !== groupId)
          : [...prev, groupId]
        if (!isNew) {
          void persistMemoryConfig({ emojiGroupIds: next })
        }
        return next
      })
    },
    [isNew, persistMemoryConfig]
  )

  const handleEmojiEnabledChange = useCallback(
    (enabled: boolean) => {
      setEmojiEnabled(enabled)
      if (!isNew) {
        void persistMemoryConfig({ emojiEnabled: enabled })
      }
    },
    [isNew, persistMemoryConfig]
  )

  const handleSave = async () => {
    if (!name.trim()) {
      toast.showError(t('agent.assistant.name_required', '请输入伙伴名称'))
      return
    }

    if (!dbReady || !services) return
    setSaving(true)

    try {
      const assistantId = isNew ? Date.now().toString() : (id as string)
      const existingList = isNew
        ? []
        : await listAssistantsForUi(
            services.assistantManager,
            services.attachmentManager,
            services.fileSystem,
            { preferFileUri: false }
          )

      let finalAvatarPath =
        normalizePersistedAvatarPath(storedAvatarPath) || DEFAULT_BUILTIN_ASSISTANT_AVATAR_PATH
      if (pendingImportUri) {
        finalAvatarPath = await services.attachmentManager.importAvatar(pendingImportUri, 'agent')
      }

      const repoInput = buildAssistantRepoInput({
        name: name.trim(),
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        isDefault: existingAssistant?.isDefault ?? existingList.length === 0,
        isPinned: existingAssistant?.isPinned ?? false,
        providerId: providerId || null,
        modelId: modelId || null,
        avatarPath: finalAvatarPath,
        contextWindow: isUnlimitedContext ? -1 : Math.round(contextWindow),
        compressTokenThreshold: isCompressDisabled ? 0 : Math.round(compressTokenThreshold),
        compressKeepTurns: Math.round(compressKeepTurns),
        compressSystemPrompt: isCompressDisabled ? null : compressSystemPrompt.trim() || null,
        assistantKind,
        emojiEnabled,
        emojiGroupIds: selectedEmojiGroupIds
      })

      if (isNew) {
        await services.assistantManager.create({ id: assistantId, ...repoInput })
      } else {
        await services.assistantManager.update(assistantId, repoInput)
      }

      toast.showSuccess(isNew ? t('agent.assistant.created') : t('agent.assistant.updated'))
      markAssistantsNeedRefresh()
      router.back()
    } catch (e) {
      console.error('Failed to save assistant', e)
      toast.showError(t('common.errors.save_failed', '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (isNew) return

    Keyboard.dismiss()
    const confirmed = await dialog.confirm(t('agent.assistant.delete_confirm_content'), {
      title: t('agent.assistant.delete_confirm_title'),
      confirmText: t('common.delete'),
      destructive: true
    })
    if (!confirmed) return
    try {
      await services?.assistantManager.delete(id as string)
      toast.showSuccess(t('agent.assistant.deleted'))
      markAssistantsNeedRefresh()
      router.back()
    } catch (e) {
      console.error('Failed to delete assistant', e)
      toast.showError(t('common.delete_failed', '删除失败'))
    }
  }

  const screenTitle = isNew
    ? t('agent.assistant.create_title', '创建伙伴')
    : t('agent.assistant.edit_title', '编辑伙伴')

  return {
    t,
    i18n,
    colors,
    isDark,
    toast,
    router,
    insets,
    isNew,
    name,
    setName,
    description,
    setDescription,
    assistantKind,
    handleKindChange,
    systemPrompt,
    setSystemPrompt,
    providerId,
    setProviderId,
    modelId,
    setModelId,
    storedAvatarPath,
    previewAvatarUri,
    contextWindow,
    compressTokenThreshold,
    compressKeepTurns,
    compressSystemPrompt,
    setCompressSystemPrompt,
    isUnlimitedContext,
    isCompressDisabled,
    setContextWindow,
    setCompressTokenThreshold,
    setCompressKeepTurns,
    persistMemoryConfig,
    chatProviders,
    loading,
    saving,
    showModelSwitcher,
    setShowModelSwitcher,
    outerScrollEnabled,
    setOuterScrollEnabled,
    emojiGroups,
    globalEmojiEnabled,
    emojiEnabled,
    selectedEmojiGroupIds,
    handlePickImage,
    handleSelectBuiltin,
    clearModelBinding,
    openModelSwitcher,
    handleToggleEmojiGroup,
    handleEmojiEnabledChange,
    handleSave,
    handleDelete,
    canDelete: !isNew,
    screenTitle
  }
}
