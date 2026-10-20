import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme, Switch, Input, HelpTooltip } from '@baishou/ui/native'
import { isDeepSeekOfficialProvider, type AIProviderConfig } from '@baishou/shared'
import { ProviderBrandIcon } from './ProviderBrandIcon'
import { AIProviderModelList } from './AIProviderModelList'
import { useAIProviderConfigForm } from './useAIProviderConfigForm'
import { aiProviderConfigFormStyles as styles } from './ai-provider-config-form.styles'
import type { ProviderListItem } from '../utils/provider-settings'

interface AIProviderConfigFormProps {
  providerId: string
  providerMeta?: ProviderListItem
  savedProviders: AIProviderConfig[]
  onProvidersChange: (next: AIProviderConfig[]) => void
}

export const AIProviderConfigForm: React.FC<AIProviderConfigFormProps> = (props) => {
  const { providerId } = props
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const {
    activeConfig,
    localApiKey,
    setLocalApiKey,
    localBaseUrl,
    setLocalBaseUrl,
    modelSearchQuery,
    setModelSearchQuery,
    isTesting,
    isFetching,
    normalizeBaseUrlOnBlur,
    handleSaveConfig,
    handleResetConfig,
    handleToggleEnable,
    handleFetchModels,
    handleEnableDialogueModels,
    handleTestConnection,
    handleDeleteProvider,
    sortedDisplayModels,
    visibleModels,
    hasMoreModels,
    showAllLoadedHint,
    toggleModelEnabled,
    loadMoreModels
  } = useAIProviderConfigForm(props)

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
        placeholder={
          props.providerMeta?.defaultBase || t('tts.settings.base_url_label', 'API Base URL')
        }
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

      <AIProviderModelList
        providerId={providerId}
        models={activeConfig.models || []}
        enabledModels={activeConfig.enabledModels || []}
        modelSearchQuery={modelSearchQuery}
        onModelSearchQueryChange={setModelSearchQuery}
        sortedDisplayModels={sortedDisplayModels}
        visibleModels={visibleModels}
        hasMoreModels={hasMoreModels}
        showAllLoadedHint={showAllLoadedHint}
        onLoadMore={loadMoreModels}
        onToggleModel={toggleModelEnabled}
        onEnableDialogueModels={handleEnableDialogueModels}
      />

      {!activeConfig.isSystem && (
        <TouchableOpacity style={styles.deleteLink} onPress={handleDeleteProvider}>
          <Text style={{ color: colors.error, fontWeight: '600' }}>{t('common.delete')}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
