import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  Switch,
  Input,
  ModelVisionBadge,
  HelpTooltip
} from '@baishou/ui/native'
import {
  AIProviderConfig,
  isDeepSeekOfficialProvider,
  isEmbeddingModel,
  isTtsModel
} from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { ProviderBrandIcon } from './ProviderBrandIcon'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import {
  buildAndCacheProviderListItems,
  computeSortOrderOnEnable,
  effectiveProviderBaseUrl,
  fetchProviderModelsViaRegistry,
  getChatModelsForTest,
  getProviderConfig,
  patchProviderInList,
  testProviderConnectionViaRegistry,
  type ProviderListItem
} from '../utils/provider-settings'

const MODEL_PAGE_SIZE = 10

interface AIProviderConfigFormProps {
  providerId: string
  providerMeta?: ProviderListItem
  savedProviders: AIProviderConfig[]
  onProvidersChange: (next: AIProviderConfig[]) => void
}

export const AIProviderConfigForm: React.FC<AIProviderConfigFormProps> = ({
  providerId,
  providerMeta,
  savedProviders,
  onProvidersChange
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const toast = useNativeToast()
  const dialog = useDialog()

  const [localApiKey, setLocalApiKey] = useState('')
  const [localBaseUrl, setLocalBaseUrl] = useState('')
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [modelVisibleCount, setModelVisibleCount] = useState(MODEL_PAGE_SIZE)
  const [isTesting, setIsTesting] = useState(false)
  const [isFetching, setIsFetching] = useState(false)

  const activeConfig = useMemo(
    () => getProviderConfig(savedProviders, providerId, providerMeta),
    [savedProviders, providerId, providerMeta]
  )

  useEffect(() => {
    setLocalApiKey(activeConfig.apiKey || '')
    setLocalBaseUrl(activeConfig.baseUrl || providerMeta?.defaultBase || '')
    setModelSearchQuery('')
    setModelVisibleCount(MODEL_PAGE_SIZE)
  }, [providerId, activeConfig.apiKey, activeConfig.baseUrl, providerMeta?.defaultBase])

  useEffect(() => {
    setModelVisibleCount(MODEL_PAGE_SIZE)
  }, [providerId, modelSearchQuery, activeConfig.models])

  const persistProvider = async (updates: Partial<AIProviderConfig>) => {
    if (!services || !dbReady) return
    const next = patchProviderInList(savedProviders, providerId, updates, providerMeta)
    await services.settingsManager.set('ai_providers', next)
    onProvidersChange(next)
  }

  const handleSaveConfig = async () => {
    const baseUrl = effectiveProviderBaseUrl(
      providerId,
      activeConfig.type,
      localBaseUrl,
      providerMeta?.defaultBase || ''
    )
    try {
      const shouldEnable = !activeConfig.isEnabled && localApiKey.trim().length > 0
      const updates: Partial<AIProviderConfig> = { apiKey: localApiKey, baseUrl }
      if (shouldEnable) {
        const items = buildAndCacheProviderListItems(savedProviders, t)
        updates.isEnabled = true
        updates.sortOrder = computeSortOrderOnEnable(items)
      }
      await persistProvider(updates)
      toast.showSuccess(t('ai_config.save_success', { id: providerId }))
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : t('ai_config.save_failed'))
    }
  }

  const handleResetConfig = () => {
    setLocalBaseUrl(providerMeta?.defaultBase || '')
    setLocalApiKey('')
    toast.showSuccess(t('ai_config.reset_success'))
  }

  const normalizeBaseUrlOnBlur = (url: string) => {
    if (url.includes('generativelanguage.googleapis.com') && !url.includes('v1')) {
      return url.replace(/\/+$/, '') + '/v1beta'
    }
    return url
  }

  const handleToggleEnable = async (enabled: boolean) => {
    if (enabled) {
      const items = buildAndCacheProviderListItems(savedProviders, t)
      const sortOrder = computeSortOrderOnEnable(items)
      await persistProvider({ isEnabled: enabled, sortOrder })
      return
    }
    await persistProvider({ isEnabled: enabled })
  }

  const handleFetchModels = async () => {
    if (!localApiKey.trim()) {
      toast.showWarning(t('ai_config.fill_api_key_hint'))
      return
    }
    const baseUrl = effectiveProviderBaseUrl(
      providerId,
      activeConfig.type,
      localBaseUrl,
      providerMeta?.defaultBase || ''
    )
    setIsFetching(true)
    try {
      await persistProvider({ apiKey: localApiKey, baseUrl })
      const config = getProviderConfig(savedProviders, providerId, providerMeta)
      const models = await fetchProviderModelsViaRegistry(
        { ...config, apiKey: localApiKey, baseUrl },
        localApiKey,
        baseUrl
      )
      const prevEnabled = config.enabledModels || []
      let enabledModels: string[]
      if (prevEnabled.length > 0) {
        const matched = models.filter((m) => prevEnabled.includes(m))
        enabledModels = matched.length > 0 ? matched : models
      } else {
        // 首次获取模型：默认启用对话模型（若没有分类则启用全部），避免在切换模型弹窗为空
        const dialogueModels = models.filter((m) => !isEmbeddingModel(m) && !isTtsModel(m))
        enabledModels = dialogueModels.length > 0 ? dialogueModels : models
      }
      const shouldEnable = !config.isEnabled
      const items = shouldEnable ? buildAndCacheProviderListItems(savedProviders, t) : []
      await persistProvider({
        models,
        enabledModels,
        apiKey: localApiKey,
        baseUrl,
        ...(shouldEnable ? { isEnabled: true, sortOrder: computeSortOrderOnEnable(items) } : {})
      })
      toast.showSuccess(t('ai_config.fetch_models_success'))
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : t('ai_config.fetch_models_failed'))
    } finally {
      setIsFetching(false)
    }
  }

  const handleEnableDialogueModels = async () => {
    const currentConfig = getProviderConfig(savedProviders, providerId, providerMeta)
    const models = currentConfig.models || []
    const dialogueModels = models.filter((m) => !isEmbeddingModel(m) && !isTtsModel(m))
    const toEnable = dialogueModels.length > 0 ? dialogueModels : models
    const shouldEnable = !currentConfig.isEnabled
    const items = shouldEnable ? buildAndCacheProviderListItems(savedProviders, t) : []
    await persistProvider({
      enabledModels: toEnable,
      ...(shouldEnable ? { isEnabled: true, sortOrder: computeSortOrderOnEnable(items) } : {})
    })
    toast.showSuccess(
      t('ai_config.models_enabled_count', `已启用 ${toEnable.length} 个模型`, {
        count: toEnable.length
      })
    )
  }

  const runTestConnection = async (testModelId: string) => {
    const baseUrl = effectiveProviderBaseUrl(
      providerId,
      activeConfig.type,
      localBaseUrl,
      providerMeta?.defaultBase || ''
    )
    setIsTesting(true)
    try {
      await persistProvider({ apiKey: localApiKey, baseUrl })
      const config = getProviderConfig(savedProviders, providerId, providerMeta)
      await testProviderConnectionViaRegistry(
        { ...config, apiKey: localApiKey, baseUrl },
        localApiKey,
        baseUrl,
        testModelId
      )
      toast.showSuccess(t('ai_config.test_connection_success'))
    } catch (e: unknown) {
      toast.showError(
        t('ai_config.test_connection_failed', {
          e: e instanceof Error ? e.message : String(e)
        })
      )
    } finally {
      setIsTesting(false)
    }
  }

  const handleTestConnection = async () => {
    if (!localApiKey.trim()) {
      toast.showWarning(t('ai_config.fill_api_key_hint'))
      return
    }
    const chatModels = getChatModelsForTest(activeConfig)
    if (chatModels.length === 0) {
      toast.showWarning(t('ai_config.no_chat_models_for_test'))
      return
    }
    if (chatModels.length === 1) {
      await runTestConnection(chatModels[0])
      return
    }
    const picked = await dialog.choose(
      t('ai_config.test_connection_title', '选择测试模型'),
      chatModels.map((modelId) => ({
        label: modelId,
        value: modelId,
        leading: <ProviderBrandIcon providerId={providerId} size={18} />
      })),
      t('ai_config.test_connection_desc')
    )
    if (picked) await runTestConnection(picked)
  }

  const handleDeleteProvider = async () => {
    if (activeConfig.isSystem) {
      toast.showWarning(t('settings.provider_disabled'))
      return
    }
    const confirmed = await dialog.confirm(t('agent.assistant.delete_confirm_content'), {
      title: t('common.delete'),
      confirmText: t('common.delete'),
      destructive: true
    })
    if (!confirmed || !services || !dbReady) return
    const next = savedProviders.filter((p) => p.id !== providerId)
    await services.settingsManager.set('ai_providers', next)
    onProvidersChange(next)
    toast.showSuccess(t('common.delete_success'))
  }

  const sortedDisplayModels = useMemo(() => {
    const models = activeConfig.models || []
    const enabledSet = new Set(activeConfig.enabledModels || [])
    const q = modelSearchQuery.trim().toLowerCase()
    return [...models]
      .filter((m) => !q || m.toLowerCase().includes(q))
      .sort((a, b) => {
        const aOn = enabledSet.has(a)
        const bOn = enabledSet.has(b)
        if (aOn !== bOn) return aOn ? -1 : 1
        return a.localeCompare(b)
      })
  }, [activeConfig.models, activeConfig.enabledModels, modelSearchQuery])

  const visibleModels = useMemo(
    () => sortedDisplayModels.slice(0, modelVisibleCount),
    [sortedDisplayModels, modelVisibleCount]
  )

  const hasMoreModels = modelVisibleCount < sortedDisplayModels.length

  const toggleModelEnabled = async (modelId: string, nextEnabled?: boolean) => {
    const currentConfig = getProviderConfig(savedProviders, providerId, providerMeta)
    const enabled = new Set(currentConfig.enabledModels || [])
    const shouldEnable = nextEnabled ?? !enabled.has(modelId)
    if (shouldEnable) enabled.add(modelId)
    else enabled.delete(modelId)
    await persistProvider({ enabledModels: Array.from(enabled) })
  }

  const cardStyle = {
    backgroundColor: colors.bgSurface,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle
  }

  return (
    <View style={[styles.configCard, cardStyle]}>
      <View style={styles.configHeader}>
        <View style={styles.configTitleRow}>
          <ProviderBrandIcon providerId={providerId} size={24} />
          <Text style={[styles.configTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {activeConfig.name}
          </Text>
          {isDeepSeekOfficialProvider(providerId) ? (
            <HelpTooltip
              content={t(
                'ai_config.deepseek_peak_pricing_help',
                '本地费用估算根据 DeepSeek 官方规则按调用时段区分计费：\n\n• 高峰时段（按平时 2 倍估算）：工作日 9:00–12:00、14:00–18:00（北京时间）\n• 空闲时段（正常单价）：工作日其余时段、周末及法定节假日\n\n注：仅用于本地成本估算参考，实际扣费以 DeepSeek 控制台账单为准。'
              )}
            />
          ) : null}
        </View>
        <Switch value={activeConfig.isEnabled} onValueChange={handleToggleEnable} />
      </View>

      {activeConfig.isSystem && (
        <Text style={[styles.systemBadge, { color: colors.textSecondary }]}>
          {t('agent.provider.system', '系统内置')}
        </Text>
      )}

      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {t('ai_config.base_url', 'API 地址')}
      </Text>
      <Input
        value={localBaseUrl}
        onChangeText={setLocalBaseUrl}
        onEndEditing={() => {
          const normalized = normalizeBaseUrlOnBlur(localBaseUrl)
          if (normalized !== localBaseUrl) setLocalBaseUrl(normalized)
        }}
        placeholder={providerMeta?.defaultBase || t('tts.settings.base_url_label', 'API Base URL')}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {t('ai_config.api_key', 'API Key')}
      </Text>
      <Input
        value={localApiKey}
        onChangeText={setLocalApiKey}
        placeholder={t('ai_config.api_key_placeholder', 'API Key')}
        secureTextEntry
        autoCapitalize="none"
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.bgApp }]}
          onPress={handleSaveConfig}
        >
          <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
            {t('common.save')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.bgApp }]}
          onPress={handleResetConfig}
        >
          <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
            {t('settings.reset_default', '恢复默认')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <Text style={[styles.actionBtnText, { color: colors.textOnPrimary }]}>
              {t('settings.test_connection')}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.bgApp }]}
          onPress={handleFetchModels}
          disabled={isFetching}
        >
          {isFetching ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
              {t('settings.fetch_models')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {(activeConfig.models?.length ?? 0) === 0 ? (
        <View style={styles.emptyModelsContainer}>
          <Text style={[styles.emptyModelsText, { color: colors.textTertiary }]}>
            {t('settings.no_models_hint', '暂无模型，可点击上方「获取模型」')}
          </Text>
        </View>
      ) : (
        <>
          <Input
            value={modelSearchQuery}
            onChangeText={setModelSearchQuery}
            placeholder={t('common.search_model')}
            containerStyle={styles.searchInput}
          />
          {(activeConfig.enabledModels?.length ?? 0) === 0 && (
            <View
              style={[
                styles.noEnabledBanner,
                {
                  backgroundColor: colors.bgSurfaceHigh,
                  borderColor: colors.borderSubtle
                }
              ]}
            >
              <Text style={[styles.noEnabledBannerText, { color: colors.textSecondary }]}>
                {t(
                  'ai_config.no_models_enabled_hint',
                  '当前未开启任何模型，该供应商不会显示在模型切换列表中'
                )}
              </Text>
              <TouchableOpacity
                style={[styles.enableAllBtn, { backgroundColor: colors.primary }]}
                onPress={handleEnableDialogueModels}
              >
                <Text style={[styles.enableAllBtnText, { color: colors.textOnPrimary }]}>
                  {t('ai_config.enable_dialogue_models', '启用所有对话模型')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.modelList}>
            {sortedDisplayModels.length === 0 ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: mobileTypography.secondary.fontSize
                }}
              >
                {t('common.no_match_model')}
              </Text>
            ) : (
              visibleModels.map((modelId) => {
                const on = (activeConfig.enabledModels || []).includes(modelId)
                return (
                  <View
                    key={modelId}
                    style={[styles.modelRow, { borderBottomColor: colors.borderSubtle }]}
                  >
                    <View style={styles.modelRowLeading}>
                      <ProviderBrandIcon providerId={providerId} size={18} />
                    </View>
                    <View style={styles.modelRowTitle}>
                      <Text
                        style={[
                          styles.modelRowText,
                          { color: on ? colors.primary : colors.textPrimary }
                        ]}
                        numberOfLines={1}
                      >
                        {modelId}
                      </Text>
                      <ModelVisionBadge modelId={modelId} providerKey={providerId} size={14} />
                    </View>
                    <Switch
                      value={on}
                      onValueChange={(next) => toggleModelEnabled(modelId, next)}
                    />
                  </View>
                )
              })
            )}
            {hasMoreModels ? (
              <TouchableOpacity
                style={[styles.loadMoreModelsBtn, { backgroundColor: colors.bgApp }]}
                onPress={() => setModelVisibleCount((count) => count + MODEL_PAGE_SIZE)}
                activeOpacity={0.8}
              >
                <Text style={[styles.loadMoreModelsText, { color: colors.primary }]}>
                  {t('common.load_more', '加载更多')} ({visibleModels.length}/
                  {sortedDisplayModels.length})
                </Text>
              </TouchableOpacity>
            ) : sortedDisplayModels.length > MODEL_PAGE_SIZE ? (
              <Text style={[styles.modelCountHint, { color: colors.textTertiary }]}>
                {t('common.loaded_all', '已全部加载')} ({sortedDisplayModels.length})
              </Text>
            ) : null}
          </View>
        </>
      )}

      {!activeConfig.isSystem && (
        <TouchableOpacity style={styles.deleteLink} onPress={handleDeleteProvider}>
          <Text style={{ color: colors.error, fontWeight: '600' }}>{t('common.delete')}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  configCard: {
    padding: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.sm
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  configTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    flex: 1
  },
  configTitle: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600',
    flexShrink: 1
  },
  systemBadge: {
    fontSize: mobileTypography.caption.fontSize,
    marginBottom: sharedTokens.spacing.xs
  },
  fieldLabel: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xs
  },
  searchInput: {
    marginTop: sharedTokens.spacing.sm
  },
  actionRow: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.sm,
    marginTop: sharedTokens.spacing.xs
  },
  actionBtn: {
    flex: 1,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center'
  },
  actionBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  emptyModelsContainer: {
    paddingVertical: sharedTokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyModelsText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center'
  },
  noEnabledBanner: {
    marginTop: sharedTokens.spacing.xs,
    padding: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    gap: sharedTokens.spacing.xs,
    alignItems: 'center'
  },
  noEnabledBannerText: {
    fontSize: mobileTypography.secondary.fontSize,
    textAlign: 'center'
  },
  enableAllBtn: {
    paddingVertical: sharedTokens.spacing.xs,
    paddingHorizontal: sharedTokens.spacing.md,
    borderRadius: sharedTokens.radius.sm
  },
  enableAllBtnText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  modelList: {
    marginTop: sharedTokens.spacing.xs
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sharedTokens.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: sharedTokens.spacing.sm
  },
  modelRowLeading: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  modelRowTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0
  },
  modelRowText: {
    flexShrink: 1,
    fontSize: mobileTypography.secondary.fontSize
  },
  loadMoreModelsBtn: {
    marginTop: sharedTokens.spacing.smPlus,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center'
  },
  loadMoreModelsText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  modelCountHint: {
    marginTop: sharedTokens.spacing.smPlus,
    textAlign: 'center',
    fontSize: mobileTypography.caption.fontSize
  },
  deleteLink: {
    marginTop: sharedTokens.spacing.mdTight,
    alignItems: 'center'
  }
})
