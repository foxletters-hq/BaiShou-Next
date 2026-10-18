import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react-native'
import { Database, MessageCircle, Pencil, ScrollText, Waypoints } from 'lucide-react-native'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  ModelSwitcher,
  HelpTooltip
} from '@baishou/ui/native'
import {
  AIProviderConfig,
  GlobalModelsConfig,
  filterProvidersForModelSwitcher,
  formatReasoningEffortLabel,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  resolveReasoningEffortForSlot,
  setReasoningEffortForSlot,
  type ModelReasoningSlot,
  type ModelSwitcherProvider,
  type ReasoningEffortSetting,
  type RagConfig
} from '@baishou/shared'
import { getDefaultGlobalModels } from '@baishou/store'
import { useBaishou } from '../../../providers/BaishouProvider'
import { ProviderBrandIcon } from './ProviderBrandIcon'
import { consumeAiModelsEmbeddingFocus } from '../ai-models-embedding-focus'
import { iconSizes, mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

type ModelSelectorKey =
  | 'globalDialogue'
  | 'globalGraph'
  | 'globalNaming'
  | 'globalSummary'
  | 'globalEmbedding'

const MODEL_FIELD_META: Array<{
  key: ModelSelectorKey
  labelKey: string
  tooltipKey: string
  icon: LucideIcon
  forEmbedding: boolean
}> = [
  {
    key: 'globalSummary',
    labelKey: 'ai_config.summary_model_title',
    tooltipKey: 'settings.tooltip_summary_model',
    icon: ScrollText,
    forEmbedding: false
  },
  {
    key: 'globalDialogue',
    labelKey: 'ai_config.dialogue_model_title',
    tooltipKey: 'settings.tooltip_chat_model',
    icon: MessageCircle,
    forEmbedding: false
  },
  {
    key: 'globalGraph',
    labelKey: 'ai_config.graph_model_title',
    tooltipKey: 'settings.tooltip_graph_model',
    icon: Waypoints,
    forEmbedding: false
  },
  {
    key: 'globalNaming',
    labelKey: 'ai_config.naming_model_title',
    tooltipKey: 'settings.tooltip_naming_model',
    icon: Pencil,
    forEmbedding: false
  },
  {
    key: 'globalEmbedding',
    labelKey: 'ai_config.embedding_model_title',
    tooltipKey: 'settings.tooltip_embedding_model',
    icon: Database,
    forEmbedding: true
  }
]

function buildFilteredProviders(
  providers: AIProviderConfig[],
  forEmbedding: boolean
): ModelSwitcherProvider[] {
  return filterProvidersForModelSwitcher(providers, forEmbedding ? 'embedding' : 'dialogue')
}

function selectorReasoningSlot(key: ModelSelectorKey): ModelReasoningSlot | null {
  switch (key) {
    case 'globalDialogue':
      return 'dialogue'
    case 'globalGraph':
      return 'graph'
    case 'globalNaming':
      return 'naming'
    case 'globalSummary':
      return 'summary'
    default:
      return null
  }
}

export const AIModelsSection: React.FC = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()

  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [globalModels, setGlobalModels] = useState<GlobalModelsConfig>({} as GlobalModelsConfig)
  const [activeSelector, setActiveSelector] = useState<ModelSelectorKey | null>(null)

  const loadConfig = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      const providerList =
        (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
      setProviders(providerList)
      const globalModelsConfig =
        (await services.settingsManager.get<GlobalModelsConfig>('global_models')) ||
        ({} as GlobalModelsConfig)
      setGlobalModels({
        ...getDefaultGlobalModels(),
        ...globalModelsConfig
      })
      if (!consumeAiModelsEmbeddingFocus()) return
      toast.showInfo(t('memory.readiness_need_embedding', '需要先配置嵌入模型'))
      const filtered = buildFilteredProviders(providerList, true)
      if (filtered.length === 0) {
        toast.showWarning(t('settings.no_models_available'))
        return
      }
      setActiveSelector('globalEmbedding')
    } catch (e) {
      console.warn('Load models config failed', e)
    }
  }, [dbReady, services, t, toast])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useFocusEffect(
    useCallback(() => {
      void loadConfig()
    }, [loadConfig])
  )

  const activeFieldMeta = activeSelector
    ? MODEL_FIELD_META.find((f) => f.key === activeSelector)
    : null

  const switcherProviders = useMemo(() => {
    if (!activeFieldMeta) return []
    return buildFilteredProviders(providers, activeFieldMeta.forEmbedding)
  }, [providers, activeFieldMeta])

  const openSelector = (fieldKey: ModelSelectorKey, forEmbedding: boolean) => {
    const filtered = buildFilteredProviders(providers, forEmbedding)
    if (filtered.length === 0) {
      toast.showWarning(t('settings.no_models_available'))
      return
    }
    setActiveSelector(fieldKey)
  }

  const handleSelectModel = async (
    providerId: string,
    modelId: string,
    effort?: ReasoningEffortSetting
  ) => {
    const selectorKey = activeSelector
    if (!selectorKey || !services || !dbReady) return

    const providerKey = `${selectorKey}ProviderId` as keyof GlobalModelsConfig
    const modelKey = `${selectorKey}ModelId` as keyof GlobalModelsConfig

    const latestConfig =
      (await services.settingsManager.get<GlobalModelsConfig>('global_models')) ||
      getDefaultGlobalModels()

    if (selectorKey === 'globalEmbedding') {
      const currentProvider = latestConfig.globalEmbeddingProviderId
      const currentModel = latestConfig.globalEmbeddingModelId
      const isSwitching =
        isConfiguredProviderId(currentProvider) &&
        isConfiguredDialogueModelId(currentModel) &&
        (currentProvider !== providerId || currentModel !== modelId)

      if (isSwitching) {
        const confirmed = await dialog.confirm(t('agent.rag.migration_switch_warning_content'), {
          title: t('agent.rag.migration_switch_warning_title')
        })
        if (!confirmed) {
          setActiveSelector(null)
          return
        }
      }
    }

    const slot = selectorReasoningSlot(selectorKey)
    const updatedReasoningEffort =
      slot && effort
        ? setReasoningEffortForSlot(latestConfig.reasoningEffortBySlot, slot, effort)
        : latestConfig.reasoningEffortBySlot

    const newConfig: GlobalModelsConfig = {
      ...latestConfig,
      [providerKey]: providerId,
      [modelKey]: modelId,
      reasoningEffortBySlot: updatedReasoningEffort
    }

    try {
      await services.settingsManager.set('global_models', newConfig)
      setGlobalModels(newConfig)

      if (selectorKey === 'globalEmbedding') {
        const rag =
          (await services.settingsManager.get<RagConfig>('rag_config')) ||
          ({} as Partial<RagConfig>)
        if (rag.ragEnabled === false) {
          await services.settingsManager.set('rag_config', { ...rag, ragEnabled: true })
        }
        try {
          await services.ragService.detectDimension()
        } catch (error) {
          toast.showError(
            error instanceof Error
              ? error.message
              : t('settings.rag.detect_failed', '检测失败，请检查模型配置')
          )
        }
      }

      toast.showSuccess(t('settings.global_models_updated', '全局默认模型已更新'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    } finally {
      setActiveSelector(null)
    }
  }

  const getModelDisplay = (modelKey: keyof GlobalModelsConfig) => {
    const mid = globalModels[modelKey] as string | undefined
    return isConfiguredDialogueModelId(mid) ? mid!.trim() : t('settings.not_set')
  }

  const cardStyle = useMemo(
    () => ({
      backgroundColor: colors.bgSurface,
      borderRadius: tokens.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle
    }),
    [colors, tokens]
  )

  return (
    <View style={styles.section}>
      {MODEL_FIELD_META.map((field) => {
        const RouteIcon = field.icon
        const displayProviderKey = `${field.key}ProviderId` as keyof GlobalModelsConfig
        const displayModelKey = `${field.key}ModelId` as keyof GlobalModelsConfig
        const isSet = Boolean(
          isConfiguredProviderId(globalModels[displayProviderKey] as string) &&
          isConfiguredDialogueModelId(globalModels[displayModelKey] as string)
        )
        const selectedProvider = isSet
          ? providers.find((p) => p.id === globalModels[displayProviderKey])
          : undefined
        const slot = selectorReasoningSlot(field.key)
        const effortLabel = slot
          ? formatReasoningEffortLabel(
              resolveReasoningEffortForSlot(globalModels.reasoningEffortBySlot, slot)
            )
          : null

        return (
          <View key={field.key} style={[styles.routingCard, cardStyle]}>
            <View style={styles.routeHeader}>
              <View
                style={[
                  styles.routeIcon,
                  {
                    backgroundColor: field.forEmbedding
                      ? colors.errorContainer
                      : colors.primaryContainer
                  }
                ]}
              >
                <RouteIcon
                  size={20}
                  color={field.forEmbedding ? colors.error : colors.primary}
                  strokeWidth={2}
                />
              </View>
              <View style={styles.titleRow}>
                <Text style={[styles.routeName, { color: colors.textPrimary }]}>
                  {t(field.labelKey)}
                </Text>
                <HelpTooltip content={t(field.tooltipKey)} size={16} />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.selectorBtn,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderControl
                }
              ]}
              activeOpacity={0.7}
              onPress={() => {
                openSelector(field.key, field.forEmbedding)
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: sharedTokens.spacing.sm,
                  flex: 1
                }}
              >
                {isSet && (
                  <ProviderBrandIcon
                    providerId={globalModels[displayProviderKey] as string}
                    providerType={selectedProvider?.type}
                    size={18}
                  />
                )}
                <Text
                  style={[
                    styles.selectorValue,
                    { color: isSet ? colors.textPrimary : colors.textTertiary }
                  ]}
                  numberOfLines={2}
                >
                  {isSet
                    ? effortLabel
                      ? `${getModelDisplay(displayModelKey)} · ${effortLabel}`
                      : getModelDisplay(displayModelKey)
                    : t('models.click_to_assign', '点击分配默认处理模型')}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
            </TouchableOpacity>
          </View>
        )
      })}

      <ModelSwitcher
        isOpen={activeSelector !== null}
        onClose={() => setActiveSelector(null)}
        providers={switcherProviders}
        currentProviderId={
          activeSelector
            ? (globalModels[`${activeSelector}ProviderId` as keyof GlobalModelsConfig] as string)
            : null
        }
        currentModelId={
          activeSelector
            ? (globalModels[`${activeSelector}ModelId` as keyof GlobalModelsConfig] as string)
            : null
        }
        onSelect={handleSelectModel}
        onManageProviders={() => router.push('/settings/ai-services')}
        showReasoningPanel={Boolean(activeSelector && selectorReasoningSlot(activeSelector))}
        reasoningEffort={
          activeSelector && selectorReasoningSlot(activeSelector)
            ? resolveReasoningEffortForSlot(
                globalModels.reasoningEffortBySlot,
                selectorReasoningSlot(activeSelector) ?? 'dialogue'
              )
            : 'auto'
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: sharedTokens.spacing.mdTight
  },
  routingCard: {
    padding: sharedTokens.spacing.md
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.smPlus,
    marginBottom: sharedTokens.spacing.mdTight
  },
  routeIcon: {
    width: 36,
    height: 36,
    borderRadius: sharedTokens.radius.control,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus
  },
  routeName: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: sharedTokens.radius.md,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.mdTight,
    gap: sharedTokens.spacing.sm
  },
  selectorValue: {
    flex: 1,
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 20
  },
  chevron: {
    fontSize: iconSizes.md,
    fontWeight: '300'
  }
})
