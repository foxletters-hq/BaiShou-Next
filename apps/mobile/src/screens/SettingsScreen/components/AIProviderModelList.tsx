import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Input, ModelVisionBadge, Switch, useNativeTheme } from '@baishou/ui/native'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { ProviderBrandIcon } from './ProviderBrandIcon'
import { aiProviderConfigFormStyles as styles } from './ai-provider-config-form.styles'

/**
 * 供应商模型列表：搜索、未启用提示、逐项开关与分页加载。
 */
export function AIProviderModelList(props: {
  providerId: string
  models: string[]
  enabledModels: string[]
  modelSearchQuery: string
  onModelSearchQueryChange: (value: string) => void
  sortedDisplayModels: string[]
  visibleModels: string[]
  hasMoreModels: boolean
  showAllLoadedHint: boolean
  onLoadMore: () => void
  onToggleModel: (modelId: string, nextEnabled?: boolean) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  if (props.models.length === 0) {
    return (
      <View style={styles.emptyModelsContainer}>
        <Text style={[styles.emptyModelsText, { color: colors.textTertiary }]}>
          {t('settings.no_models_hint', '暂无模型，可点击上方「获取模型」')}
        </Text>
      </View>
    )
  }

  return (
    <>
      <Input
        value={props.modelSearchQuery}
        onChangeText={props.onModelSearchQueryChange}
        placeholder={t('common.search_model')}
        containerStyle={styles.searchInput}
      />
      {props.enabledModels.length === 0 && (
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
        </View>
      )}
      <View style={styles.modelList}>
        {props.sortedDisplayModels.length === 0 ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.secondary.fontSize
            }}
          >
            {t('common.no_match_model')}
          </Text>
        ) : (
          props.visibleModels.map((modelId) => {
            const on = props.enabledModels.includes(modelId)
            return (
              <View
                key={modelId}
                style={[styles.modelRow, { borderBottomColor: colors.borderSubtle }]}
              >
                <View style={styles.modelRowLeading}>
                  <ProviderBrandIcon providerId={props.providerId} size={18} />
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
                  <ModelVisionBadge modelId={modelId} providerKey={props.providerId} size={14} />
                </View>
                <Switch value={on} onValueChange={(next) => props.onToggleModel(modelId, next)} />
              </View>
            )
          })
        )}
        {props.hasMoreModels ? (
          <TouchableOpacity
            style={[styles.loadMoreModelsBtn, { backgroundColor: colors.bgApp }]}
            onPress={props.onLoadMore}
            activeOpacity={0.8}
          >
            <Text style={[styles.loadMoreModelsText, { color: colors.primary }]}>
              {t('common.load_more', '加载更多')} ({props.visibleModels.length}/
              {props.sortedDisplayModels.length})
            </Text>
          </TouchableOpacity>
        ) : props.showAllLoadedHint ? (
          <Text style={[styles.modelCountHint, { color: colors.textTertiary }]}>
            {t('common.loaded_all', '已全部加载')} ({props.sortedDisplayModels.length})
          </Text>
        ) : null}
      </View>
    </>
  )
}
