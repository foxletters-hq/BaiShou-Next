import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme, useNativeToast, useDialog, Switch, Input } from '@baishou/ui/native'
import { AIProviderConfig } from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { ProviderBrandIcon } from './ProviderBrandIcon'
import {
  effectiveProviderBaseUrl,
  fetchProviderModelsViaRegistry,
  getChatModelsForTest,
  getProviderConfig,
  patchProviderInList,
  testProviderConnectionViaRegistry,
  type ProviderListItem
} from '../utils/provider-settings'

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
  }, [providerId, activeConfig.apiKey, activeConfig.baseUrl, providerMeta?.defaultBase])

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
      await persistProvider({ apiKey: localApiKey, baseUrl })
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
      const enabledModels = models.filter((m) => prevEnabled.includes(m))
      await persistProvider({ models, enabledModels, apiKey: localApiKey, baseUrl })
      toast.showSuccess(t('ai_config.fetch_models_success'))
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : t('ai_config.fetch_models_failed'))
    } finally {
      setIsFetching(false)
    }
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

  const toggleModelEnabled = async (modelId: string) => {
    const enabled = new Set(activeConfig.enabledModels || [])
    if (enabled.has(modelId)) enabled.delete(modelId)
    else enabled.add(modelId)
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
          <Text style={[styles.configTitle, { color: colors.textPrimary }]}>
            {activeConfig.name}
          </Text>
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

      {(activeConfig.models?.length ?? 0) > 0 && (
        <>
          <Input
            value={modelSearchQuery}
            onChangeText={setModelSearchQuery}
            placeholder={t('common.search_model')}
            containerStyle={styles.searchInput}
          />
          <View style={styles.modelList}>
            {sortedDisplayModels.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {t('common.no_match_model')}
              </Text>
            ) : (
              sortedDisplayModels.map((modelId) => {
                const on = (activeConfig.enabledModels || []).includes(modelId)
                return (
                  <TouchableOpacity
                    key={modelId}
                    style={[styles.modelRow, { borderBottomColor: colors.borderSubtle }]}
                    onPress={() => toggleModelEnabled(modelId)}
                  >
                    <View style={styles.modelRowLeading}>
                      <ProviderBrandIcon providerId={providerId} size={18} />
                    </View>
                    <Text
                      style={[
                        styles.modelRowText,
                        { color: on ? colors.primary : colors.textPrimary }
                      ]}
                      numberOfLines={1}
                    >
                      {modelId}
                    </Text>
                    <Switch value={on} onValueChange={() => toggleModelEnabled(modelId)} />
                  </TouchableOpacity>
                )
              })
            )}
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
    padding: 16,
    gap: 8
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  configTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  configTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1
  },
  systemBadge: {
    fontSize: 12,
    marginBottom: 4
  },
  fieldLabel: {
    fontSize: 12,
    marginTop: 4
  },
  searchInput: {
    marginTop: 8
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600'
  },
  modelList: {
    marginTop: 4
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  modelRowLeading: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  modelRowText: {
    flex: 1,
    fontSize: 13
  },
  deleteLink: {
    marginTop: 12,
    alignItems: 'center'
  }
})
