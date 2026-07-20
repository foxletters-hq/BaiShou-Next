import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react-native'
import { Database, MessageCircle, Pencil, ScrollText, Waypoints } from 'lucide-react-native'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  ModelSwitcher,
  CardLinkAction,
  HelpTooltip
} from '@baishou/ui/native'
import {
  AIProviderConfig,
  GlobalModelsConfig,
  filterProvidersForModelSwitcher,
  shouldSyncGraphModelsWithDialogue,
  type ModelSwitcherProvider
} from '@baishou/shared'
import { ensureGlobalGraphModelsAligned, getDefaultGlobalModels } from '@baishou/store'
import { useBaishou } from '../../../providers/BaishouProvider'
import { ProviderBrandIcon } from './ProviderBrandIcon'

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

  useEffect(() => {
    if (!dbReady || !services) return
    const loadConfig = async () => {
      try {
        const providerList =
          (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
        setProviders(providerList)
        const globalModelsConfig =
          (await services.settingsManager.get<GlobalModelsConfig>('global_models')) ||
          ({} as GlobalModelsConfig)
        setGlobalModels(
          ensureGlobalGraphModelsAligned({
            ...getDefaultGlobalModels(),
            ...globalModelsConfig
          })
        )
      } catch (e) {
        console.warn('Load models config failed', e)
      }
    }
    loadConfig()
  }, [dbReady, services])

  const handleSaveGlobalModels = async (config: GlobalModelsConfig) => {
    if (!services || !dbReady) return
    try {
      await services.settingsManager.set('global_models', config)
      setGlobalModels(config)
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

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

  const handleSelectModel = async (providerId: string, modelId: string) => {
    if (!activeSelector) return

    const providerKey = `${activeSelector}ProviderId` as keyof GlobalModelsConfig
    const modelKey = `${activeSelector}ModelId` as keyof GlobalModelsConfig

    if (activeSelector === 'globalEmbedding') {
      const currentProvider = globalModels.globalEmbeddingProviderId
      const currentModel = globalModels.globalEmbeddingModelId
      const isSwitching =
        currentProvider &&
        currentModel &&
        (currentProvider !== providerId || currentModel !== modelId)

      if (isSwitching) {
        const confirmed = await dialog.confirm(t('agent.rag.migration_switch_warning_content'), {
          title: t('agent.rag.migration_switch_warning_title')
        })
        if (!confirmed) return
      }
    }

    const newConfig: GlobalModelsConfig = {
      ...globalModels,
      [providerKey]: providerId,
      [modelKey]: modelId
    }
    if (
      activeSelector === 'globalDialogue' &&
      shouldSyncGraphModelsWithDialogue(globalModels)
    ) {
      newConfig.globalGraphProviderId = providerId
      newConfig.globalGraphModelId = modelId
    }
    await handleSaveGlobalModels(newConfig)
    setActiveSelector(null)
  }

  const getModelDisplay = (modelKey: keyof GlobalModelsConfig) => {
    const mid = globalModels[modelKey] as string | undefined
    return mid || t('settings.not_set')
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
        const providerKey = `${field.key}ProviderId` as keyof GlobalModelsConfig
        const modelKey = `${field.key}ModelId` as keyof GlobalModelsConfig
        const isSet = Boolean(globalModels[providerKey] && globalModels[modelKey])
        const selectedProvider = isSet
          ? providers.find((p) => p.id === globalModels[providerKey])
          : undefined

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
                  borderColor: isSet ? colors.borderMuted : colors.borderSubtle
                }
              ]}
              activeOpacity={0.7}
              onPress={() => openSelector(field.key, field.forEmbedding)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                {isSet && (
                  <ProviderBrandIcon
                    providerId={globalModels[providerKey] as string}
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
                    ? getModelDisplay(modelKey)
                    : t('models.click_to_assign', '点击分配默认处理模型')}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
            </TouchableOpacity>
          </View>
        )
      })}

      <CardLinkAction
        variant="card"
        style={{ marginTop: 4 }}
        onPress={() => router.push('/settings/ai-services')}
      >
        {t('settings.configure_providers')}
      </CardLinkAction>

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
      />
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: 12
  },
  routingCard: {
    padding: 16
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12
  },
  routeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  routeName: {
    fontSize: 16,
    fontWeight: '600'
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8
  },
  selectorValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300'
  }
})
