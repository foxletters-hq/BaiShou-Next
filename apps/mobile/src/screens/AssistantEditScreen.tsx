import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  scrollIndicatorStyle,
  Switch,
  Input,
  EmojiPicker,
  ModelSwitcher,
  SettingsSliderRow,
  SettingsGroupCard,
  settingsCardStyles,
  ProviderBrandIcon,
  AssistantAvatar,
  type MockAiProviderModel
} from '@baishou/ui/native'
import {
  AIProviderConfig,
  ASSISTANT_DEFAULT_AVATAR_SENTINEL,
  isDefaultAssistantAvatarPath,
  getDefaultCompressionSystemPrompt,
  isAssistantAvatarDirectUri,
  isAssistantAvatarRelativePath,
  isEmbeddingModel,
  isTtsModel
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { syncSettingsAssistantsToRepo } from '../services/mobile-assistant-sync.service'

interface Assistant {
  id: string
  name: string
  emoji: string
  description?: string
  systemPrompt?: string
  isDefault: boolean
  isPinned: boolean
  providerId?: string
  modelId?: string
  avatarPath?: string
  contextWindow?: number
  compressTokenThreshold?: number
  compressKeepTurns?: number
  compressSystemPrompt?: string | null
  createdAt?: number
  lastUsedAt?: number
  useCount?: number
}

function formatTokens(tokens: number): string {
  if (tokens >= 10000) {
    const w = tokens / 10000
    return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}w`
  }
  return String(tokens)
}

function formatKeepTurns(t: (key: string, fallback: string) => string, count: number): string {
  return t('agent.assistant.compress_keep_turns_unit', '$count 轮').replace(
    '$count',
    String(Math.round(count))
  )
}

function buildChatProviders(providers: AIProviderConfig[]): MockAiProviderModel[] {
  return providers
    .filter((p) => p.isEnabled && (p.enabledModels?.length || p.models?.length))
    .map((p) => {
      const pool = p.enabledModels?.length ? p.enabledModels : p.models || []
      const filtered = pool.filter((modelId) => !isEmbeddingModel(modelId) && !isTtsModel(modelId))
      return {
        id: p.id,
        name: p.name || p.id,
        type: p.type,
        enabledModels: filtered,
        models: filtered
      }
    })
    .filter((p) => (p.enabledModels?.length ?? 0) > 0)
}

export const AssistantEditScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const router = useRouter()
  const { id } = useLocalSearchParams()

  const isNew = !id || id === 'new'

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [providerId, setProviderId] = useState<string | undefined>()
  const [modelId, setModelId] = useState<string | undefined>()
  const [storedAvatarPath, setStoredAvatarPath] = useState<string | undefined>(
    ASSISTANT_DEFAULT_AVATAR_SENTINEL
  )
  const [previewAvatarUri, setPreviewAvatarUri] = useState<string | null>(null)
  const [pendingImportUri, setPendingImportUri] = useState<string | null>(null)
  const [contextWindow, setContextWindow] = useState(-1)
  const [compressTokenThreshold, setCompressTokenThreshold] = useState(60000)
  const [compressKeepTurns, setCompressKeepTurns] = useState(3)
  const [compressSystemPrompt, setCompressSystemPrompt] = useState(() =>
    getDefaultCompressionSystemPrompt()
  )
  const [existingAssistant, setExistingAssistant] = useState<Assistant | null>(null)
  const [chatProviders, setChatProviders] = useState<MockAiProviderModel[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showModelSwitcher, setShowModelSwitcher] = useState(false)

  const isUnlimitedContext = contextWindow < 0
  const isCompressDisabled = compressTokenThreshold <= 0

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
      if (isAssistantAvatarDirectUri(path)) {
        setPreviewAvatarUri(path)
        return
      }
      if (isAssistantAvatarRelativePath(path) && services) {
        try {
          const resolved = await services.attachmentManager.resolveAvatarPath(path)
          setPreviewAvatarUri(resolved)
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
      .then((list) => setChatProviders(buildChatProviders(list || [])))
      .catch(() => setChatProviders([]))
  }, [dbReady, services])

  useEffect(() => {
    if (isNew || !dbReady || !services) return

    const loadAssistant = async () => {
      try {
        const assistants = (await services.settingsManager.get<Assistant[]>('assistants')) || []
        const assistant = assistants.find((a) => a.id === id)
        if (assistant) {
          setExistingAssistant(assistant)
          setName(assistant.name)
          setEmoji(assistant.emoji || '')
          setDescription(assistant.description || '')
          setSystemPrompt(assistant.systemPrompt || '')
          setProviderId(assistant.providerId)
          setModelId(assistant.modelId)
          if (assistant.avatarPath) {
            setStoredAvatarPath(assistant.avatarPath)
          } else if (assistant.emoji) {
            setStoredAvatarPath(undefined)
          } else {
            setStoredAvatarPath(ASSISTANT_DEFAULT_AVATAR_SENTINEL)
          }
          setPendingImportUri(null)
          await resolveAvatarPreview(assistant.avatarPath)
          setContextWindow(assistant.contextWindow ?? -1)
          setCompressTokenThreshold(assistant.compressTokenThreshold ?? 60000)
          setCompressKeepTurns(assistant.compressKeepTurns ?? 3)
          setCompressSystemPrompt(
            assistant.compressSystemPrompt?.trim() ||
              getDefaultCompressionSystemPrompt(i18n.language)
          )
        } else {
          toast.showError(t('agent.assistant.not_found', '伙伴未找到'))
          router.back()
        }
      } catch (e) {
        console.error('Failed to load assistant', e)
      } finally {
        setLoading(false)
      }
    }

    void loadAssistant()
  }, [id, isNew, dbReady, services, router, t, toast, resolveAvatarPreview])

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      })
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri
        setPendingImportUri(uri)
        setPreviewAvatarUri(uri)
        setStoredAvatarPath(undefined)
        setEmoji('')
      }
    } catch {
      toast.showError(t('profile.image_pick_error', '选择图片失败'))
    }
  }, [t, toast])

  const handleAvatarPress = useCallback(async () => {
    const choice = await dialog.choose(t('emoji.personalize_avatar', '个性化头像'), [
      { label: t('emoji.picker', '选择表情'), value: 'emoji' },
      { label: t('emoji.upload_avatar_hint', '从相册选择图片'), value: 'image' }
    ])
    if (choice === 'emoji') setShowEmojiPicker(true)
    else if (choice === 'image') void handlePickImage()
  }, [dialog, handlePickImage, t])

  const handleRemoveAvatar = useCallback(() => {
    setPendingImportUri(null)
    setPreviewAvatarUri(null)
    setStoredAvatarPath(ASSISTANT_DEFAULT_AVATAR_SENTINEL)
    setEmoji('')
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

  const handleSave = async () => {
    if (!name.trim()) {
      toast.showError(t('agent.assistant.name_required', '请输入伙伴名称'))
      return
    }

    if (!dbReady || !services) return
    setSaving(true)

    try {
      const assistants = (await services.settingsManager.get<Assistant[]>('assistants')) || []

      let finalAvatarPath: string | undefined = storedAvatarPath
      if (pendingImportUri) {
        finalAvatarPath = await services.attachmentManager.importAvatar(pendingImportUri, 'agent')
      } else if (!emoji && !storedAvatarPath) {
        finalAvatarPath = ASSISTANT_DEFAULT_AVATAR_SENTINEL
      }

      const hasImageAvatar =
        Boolean(pendingImportUri) ||
        (Boolean(finalAvatarPath) &&
          !isDefaultAssistantAvatarPath(finalAvatarPath) &&
          (isAssistantAvatarRelativePath(finalAvatarPath) ||
            isAssistantAvatarDirectUri(finalAvatarPath)))

      const useDefaultBuiltinAvatar =
        !hasImageAvatar &&
        (storedAvatarPath === ASSISTANT_DEFAULT_AVATAR_SENTINEL || (!emoji && !storedAvatarPath))

      const assistantData: Assistant = {
        ...(existingAssistant || {}),
        id: isNew ? Date.now().toString() : (id as string),
        name: name.trim(),
        emoji: hasImageAvatar || useDefaultBuiltinAvatar ? '' : emoji,
        description: description.trim(),
        systemPrompt: systemPrompt.trim(),
        isDefault: existingAssistant?.isDefault ?? assistants.length === 0,
        isPinned: existingAssistant?.isPinned ?? false,
        providerId: providerId || undefined,
        modelId: modelId || undefined,
        avatarPath: hasImageAvatar
          ? finalAvatarPath
          : useDefaultBuiltinAvatar
            ? ASSISTANT_DEFAULT_AVATAR_SENTINEL
            : emoji
              ? undefined
              : (finalAvatarPath ?? ASSISTANT_DEFAULT_AVATAR_SENTINEL),
        contextWindow: isUnlimitedContext ? -1 : Math.round(contextWindow),
        compressTokenThreshold: isCompressDisabled ? 0 : Math.round(compressTokenThreshold),
        compressKeepTurns: Math.round(compressKeepTurns),
        compressSystemPrompt: isCompressDisabled ? null : compressSystemPrompt.trim() || null,
        createdAt: existingAssistant?.createdAt ?? Date.now()
      }

      const newAssistants = isNew
        ? [...assistants, assistantData]
        : assistants.map((a) => (a.id === id ? { ...a, ...assistantData } : a))

      await services.settingsManager.set('assistants', newAssistants)
      await syncSettingsAssistantsToRepo(services.settingsManager, services.assistantManager)
      toast.showSuccess(
        isNew
          ? t('agent.assistant.created', '伙伴已创建')
          : t('agent.assistant.updated', '伙伴已更新')
      )
      router.back()
    } catch (e) {
      console.error('Failed to save assistant', e)
      toast.showError(t('common.errors.save_failed', '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (isNew || existingAssistant?.isDefault) return

    const confirmed = await dialog.confirm(
      t(
        'agent.assistant.delete_confirm_content',
        '确定要删除此伙伴吗？关联的对话及附件将会被一并删除。'
      ),
      {
        title: t('agent.assistant.delete_confirm_title', '删除伙伴'),
        confirmText: t('common.delete', '删除'),
        destructive: true
      }
    )
    if (!confirmed) return
    try {
      const assistants = (await services?.settingsManager.get<Assistant[]>('assistants')) || []
      const newAssistants = assistants.filter((a) => a.id !== id)
      await services?.settingsManager.set('assistants', newAssistants)
      toast.showSuccess(t('agent.assistant.deleted', '伙伴已删除'))
      router.back()
    } catch (e) {
      console.error('Failed to delete assistant', e)
      toast.showError(t('common.delete_failed', '删除失败'))
    }
  }

  const screenTitle = isNew
    ? t('agent.assistant.create_title', '创建伙伴')
    : t('agent.assistant.edit_title', '编辑伙伴')

  const hasCustomImage =
    Boolean(pendingImportUri || previewAvatarUri) &&
    storedAvatarPath !== ASSISTANT_DEFAULT_AVATAR_SENTINEL

  if (loading) {
    return (
      <StackScreenLayout
        title={screenTitle}
        {...getStackScreenChrome(colors)}
        contentStyle={styles.loadingContainer}
      >
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('common.loading')}
        </Text>
      </StackScreenLayout>
    )
  }

  return (
    <StackScreenLayout
      title={screenTitle}
      {...getStackScreenChrome(colors)}
      headerRight={{
        label: saving ? t('common.saving') : t('common.save'),
        onPress: handleSave,
        disabled: saving
      }}
      contentStyle={styles.layoutContent}
    >
      <ScrollView
        style={[styles.content, { backgroundColor: colors.bgApp }]}
        contentContainerStyle={styles.contentContainer}
        indicatorStyle={scrollIndicatorStyle(isDark)}
      >
        <SettingsGroupCard style={styles.avatarCard}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              <Pressable onPress={() => void handleAvatarPress()}>
                <AssistantAvatar
                  emoji={emoji}
                  avatarPath={storedAvatarPath}
                  resolvedAvatarUri={previewAvatarUri}
                  size={88}
                />
              </Pressable>
              <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="sentiment-satisfied-alt" size={16} color={colors.onPrimary} />
              </View>
            </View>
            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
              {t('agent.assistant.avatar_hint', '点击更换伙伴的图标或头像')}
            </Text>
            {hasCustomImage || (emoji && storedAvatarPath !== ASSISTANT_DEFAULT_AVATAR_SENTINEL) ? (
              <TouchableOpacity onPress={handleRemoveAvatar}>
                <Text style={[styles.textBtn, { color: colors.primary }]}>
                  {t('agent.assistant.remove_avatar', '移除头像')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </SettingsGroupCard>

        <SettingsGroupCard>
          <Text style={[settingsCardStyles.cardTitle, { color: colors.textPrimary }]}>
            {t('agent.assistant.name_label', '伙伴名称')}
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={t('agent.assistant.name_hint', '例如：知识伙伴、写作伙伴...')}
          />

          <View style={styles.fieldGap} />

          <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
            {t('agent.assistant.description_label', '简介')}
          </Text>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder={t('agent.assistant.description_hint', '简短描述伙伴的用途...')}
            multiline
            numberOfLines={2}
          />

          <View style={styles.fieldGap} />

          <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
            {t('agent.assistant.prompt_label', '系统提示词')}
          </Text>
          <Input
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder={t('agent.assistant.prompt_hint', '定义伙伴的角色、行为和回复风格...')}
            multiline
            textarea
            numberOfLines={8}
            style={{ minHeight: 160 }}
          />
        </SettingsGroupCard>

        <SettingsGroupCard>
          <View style={styles.row}>
            <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
              {t('agent.assistant.bind_model_label', '绑定模型')}
            </Text>
            {providerId ? (
              <TouchableOpacity onPress={clearModelBinding}>
                <Text style={[styles.textBtn, { color: colors.primary, marginTop: 0 }]}>
                  {t('agent.assistant.use_global_model', '使用全局模型')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {!providerId ? (
            <TouchableOpacity
              style={[styles.outlinedBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => void openModelSwitcher()}
            >
              <MaterialIcons name="add" size={18} color={colors.textPrimary} />
              <Text style={[styles.outlinedBtnText, { color: colors.textPrimary }]}>
                {t('agent.assistant.select_model_label', '选择模型（使用全局默认）')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.modelCard, { borderColor: colors.borderSubtle }]}
              onPress={() => void openModelSwitcher()}
              activeOpacity={0.75}
            >
              <ProviderBrandIcon providerId={providerId} size={24} />
              <View style={styles.modelInfo}>
                <Text style={[styles.modelSup, { color: colors.textSecondary }]} numberOfLines={1}>
                  {providerId}
                </Text>
                <Text style={[styles.modelSub, { color: colors.textPrimary }]} numberOfLines={1}>
                  {modelId}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
            {t(
              'agent.assistant.bind_model_desc',
              '绑定后，和伙伴创建对话时，会默认优先使用选择的模型'
            )}
          </Text>
        </SettingsGroupCard>

        <SettingsGroupCard>
          <Text style={[settingsCardStyles.cardTitle, { color: colors.textPrimary }]}>
            {t('agent.assistant.memory_label', '记忆')}
          </Text>

          <View style={styles.row}>
            <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
              {t('agent.assistant.context_window_label', '上下文轮数')}
            </Text>
            <View style={styles.rowSpacer} />
            {!isUnlimitedContext ? (
              <Text style={[styles.valueText, { color: colors.textPrimary }]}>
                {Math.round(contextWindow)}
              </Text>
            ) : null}
            <Text style={[settingsCardStyles.hint, { color: colors.textSecondary, marginTop: 0 }]}>
              {isUnlimitedContext
                ? t('agent.assistant.context_unlimited', '∞ 无限')
                : t('agent.assistant.context_limited', '有限')}
            </Text>
            <Switch
              value={isUnlimitedContext}
              onValueChange={(unlimited) => setContextWindow(unlimited ? -1 : 20)}
            />
          </View>

          {!isUnlimitedContext ? (
            <SettingsSliderRow
              title=""
              value={contextWindow}
              min={2}
              max={100}
              step={1}
              onChange={setContextWindow}
              formatValue={(v) => String(Math.round(v))}
            />
          ) : null}

          <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
            {isUnlimitedContext
              ? t(
                  'agent.assistant.context_unlimited_desc',
                  '不限制轮数，将发送全部对话历史（每轮含你的消息、AI 回复及工具调用）给模型。'
                )
              : t(
                  'agent.assistant.context_window_desc',
                  '发送给模型的最近对话轮数。一轮以你的消息开始，包含 AI 的回复以及该轮内的工具调用；轮数越多记忆越长，但 Token 消耗也更高。'
                )}
          </Text>

          <View style={[styles.sectionDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.row}>
            <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
              {t('agent.assistant.compress_label', '自动压缩')}
            </Text>
            <View style={styles.rowSpacer} />
            {!isCompressDisabled ? (
              <Text style={[styles.valueText, { color: colors.textPrimary }]}>
                {formatTokens(Math.round(compressTokenThreshold))}
              </Text>
            ) : null}
            <Switch
              value={!isCompressDisabled}
              onValueChange={(enabled) => setCompressTokenThreshold(enabled ? 60000 : 0)}
            />
          </View>

          <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
            {isCompressDisabled
              ? t('agent.assistant.compress_disabled_desc', '对话不会自动压缩，所有消息将完整保留')
              : t('agent.assistant.compress_enabled_desc', '对话超过阈值时自动将旧消息压缩为摘要')}
          </Text>

          {!isCompressDisabled ? (
            <>
              <SettingsSliderRow
                title=""
                value={compressTokenThreshold}
                min={10000}
                max={1000000}
                step={10000}
                onChange={setCompressTokenThreshold}
                formatValue={(v) => formatTokens(Math.round(v))}
              />
              <SettingsSliderRow
                title={t('agent.assistant.compress_keep_turns_label', '保留互动轮数')}
                description={t(
                  'agent.assistant.compress_keep_turns_desc',
                  '触发压缩时，保留最近若干轮完整原文。一轮以你的消息开始，包含 AI 回复及该轮内的工具调用；更早的轮次会被压缩为摘要。'
                )}
                value={compressKeepTurns}
                min={1}
                max={10}
                step={1}
                onChange={setCompressKeepTurns}
                formatValue={(v) => formatKeepTurns(t, v)}
              />

              <View style={[styles.sectionDivider, { backgroundColor: colors.borderSubtle }]} />

              <View style={styles.row}>
                <Text style={[settingsCardStyles.label, { color: colors.textPrimary }]}>
                  {t('agent.assistant.compress_system_prompt_label', '压缩提示词')}
                </Text>
                <View style={styles.rowSpacer} />
                <TouchableOpacity
                  onPress={() =>
                    setCompressSystemPrompt(getDefaultCompressionSystemPrompt(i18n.language))
                  }
                >
                  <Text style={[styles.resetLink, { color: colors.primary }]}>
                    {t('agent.assistant.compress_system_prompt_reset', '恢复默认')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[settingsCardStyles.hint, { color: colors.textSecondary }]}>
                {t(
                  'agent.assistant.compress_system_prompt_desc',
                  '生成对话压缩摘要时发给模型的系统指令。可自定义压缩时的思考方式与摘要规则。'
                )}
              </Text>
              <Input
                textarea
                multiline
                value={compressSystemPrompt}
                onChangeText={setCompressSystemPrompt}
                style={styles.compressPromptInput}
                textAlignVertical="top"
              />
            </>
          ) : null}
        </SettingsGroupCard>

        {!isNew && !existingAssistant?.isDefault ? (
          <TouchableOpacity
            style={[
              styles.deleteButton,
              { backgroundColor: colors.error + '10', borderRadius: tokens.radius.md }
            ]}
            onPress={() => void handleDelete()}
          >
            <Text style={[styles.deleteText, { color: colors.error }]}>
              {t('agent.assistant.delete_confirm_title', '删除伙伴')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={(value) => {
          setEmoji(value)
          setPendingImportUri(null)
          setPreviewAvatarUri(null)
          setStoredAvatarPath(undefined)
        }}
      />

      <ModelSwitcher
        isOpen={showModelSwitcher}
        onClose={() => setShowModelSwitcher(false)}
        providers={chatProviders}
        currentProviderId={providerId || null}
        currentModelId={modelId || null}
        onSelect={(pid, mid) => {
          setProviderId(pid)
          setModelId(mid)
          setShowModelSwitcher(false)
        }}
      />
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontSize: 16
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32
  },
  avatarCard: {
    alignItems: 'stretch'
  },
  avatarSection: {
    alignItems: 'center'
  },
  avatarWrap: {
    width: 88,
    height: 88,
    position: 'relative'
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarHint: {
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center'
  },
  textBtn: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8
  },
  fieldGap: {
    height: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  rowSpacer: {
    flex: 1
  },
  outlinedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8
  },
  outlinedBtnText: {
    fontSize: 15,
    fontWeight: '500'
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8
  },
  modelInfo: {
    flex: 1,
    gap: 2
  },
  modelSup: {
    fontSize: 12
  },
  modelSub: {
    fontSize: 15,
    fontWeight: '600'
  },
  valueText: {
    fontSize: 14,
    fontWeight: '700'
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16
  },
  deleteButton: {
    padding: 16,
    alignItems: 'center'
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '600'
  },
  resetLink: {
    fontSize: 13,
    fontWeight: '600'
  },
  compressPromptInput: {
    minHeight: 160,
    marginTop: 8
  }
})
