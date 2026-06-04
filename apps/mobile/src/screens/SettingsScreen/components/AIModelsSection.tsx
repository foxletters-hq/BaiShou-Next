import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useNativeTheme, useNativeToast, useDialog, ModelSwitcherPopup } from '@baishou/ui/native'
import { AIProviderConfig, GlobalModelsConfig, isEmbeddingModel, isTtsModel } from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'

type ModelSelectorKey = 'globalDialogue' | 'globalNaming' | 'globalSummary' | 'globalEmbedding'

const MODEL_FIELD_META: Array<{
  key: ModelSelectorKey
  labelKey: string
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  forEmbedding: boolean
}> = [
  {
    key: 'globalSummary',
    labelKey: 'ai_config.summary_model_title',
    icon: 'file-document-outline',
    forEmbedding: false
  },
  {
    key: 'globalDialogue',
    labelKey: 'ai_config.dialogue_model_title',
    icon: 'chat-outline',
    forEmbedding: false
  },
  {
    key: 'globalNaming',
    labelKey: 'ai_config.naming_model_title',
    icon: 'pencil-outline',
    forEmbedding: false
  },
  {
    key: 'globalEmbedding',
    labelKey: 'ai_config.embedding_model_title',
    icon: 'hub',
    forEmbedding: true
  }
]

function modelCompositeId(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`
}

function parseCompositeId(composite: string): { providerId: string; modelId: string } | null {
  const idx = composite.indexOf('::')
  if (idx <= 0) return null
  return {
    providerId: composite.slice(0, idx),
    modelId: composite.slice(idx + 2)
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
  const [popupModels, setPopupModels] = useState<
    Array<{ id: string; name: string; providerId: string }>
  >([])
  const [popupSelectedId, setPopupSelectedId] = useState('')

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
        setGlobalModels(globalModelsConfig)
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

  const buildPopupModels = (forEmbedding: boolean) => {
    const items: Array<{ id: string; name: string; providerId: string }> = []
    providers
      .filter((p) => p.isEnabled && (p.enabledModels?.length || p.models?.length))
      .forEach((p) => {
        const pool = p.enabledModels?.length ? p.enabledModels : p.models || []
        pool.forEach((modelId) => {
          const isEmbed = isEmbeddingModel(modelId)
          const isTts = isTtsModel(modelId)
          if (forEmbedding && !isEmbed) return
          if (!forEmbedding && (isEmbed || isTts)) return
          items.push({
            id: modelCompositeId(p.id, modelId),
            name: modelId,
            providerId: p.name || p.id
          })
        })
      })
    return items
  }

  const openSelector = (fieldKey: ModelSelectorKey, forEmbedding: boolean) => {
    const models = buildPopupModels(forEmbedding)
    if (models.length === 0) {
      toast.showWarning(t('settings.no_models_available'))
      return
    }
    const providerKey = `${fieldKey}ProviderId` as keyof GlobalModelsConfig
    const modelKey = `${fieldKey}ModelId` as keyof GlobalModelsConfig
    const pid = String(globalModels[providerKey] ?? '')
    const mid = String(globalModels[modelKey] ?? '')
    setPopupModels(models)
    setPopupSelectedId(pid && mid ? modelCompositeId(pid, mid) : '')
    setActiveSelector(fieldKey)
  }

  const handleSelectModel = async (compositeId: string) => {
    if (!activeSelector) return
    const parsed = parseCompositeId(compositeId)
    if (!parsed) return

    const providerKey = `${activeSelector}ProviderId` as keyof GlobalModelsConfig
    const modelKey = `${activeSelector}ModelId` as keyof GlobalModelsConfig

    if (activeSelector === 'globalEmbedding') {
      const currentProvider = globalModels.globalEmbeddingProviderId
      const currentModel = globalModels.globalEmbeddingModelId
      const isSwitching =
        currentProvider &&
        currentModel &&
        (currentProvider !== parsed.providerId || currentModel !== parsed.modelId)

      if (isSwitching) {
        const confirmed = await dialog.confirm(t('agent.rag.migration_switch_warning_content'), {
          title: t('agent.rag.migration_switch_warning_title')
        })
        if (!confirmed) return
      }
    }

    const newConfig: GlobalModelsConfig = {
      ...globalModels,
      [providerKey]: parsed.providerId,
      [modelKey]: parsed.modelId
    }
    await handleSaveGlobalModels(newConfig)
    setActiveSelector(null)
  }

  const getModelDisplay = (
    providerKey: keyof GlobalModelsConfig,
    modelKey: keyof GlobalModelsConfig
  ) => {
    const pid = globalModels[providerKey] as string | undefined
    const mid = globalModels[modelKey] as string | undefined
    if (pid && mid) {
      const prov = providers.find((p) => p.id === pid)
      return prov ? `${prov.name} / ${mid}` : mid
    }
    return t('settings.not_set')
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
      <Text style={[styles.pageHint, { color: colors.textSecondary }]}>
        {t('ai_config.global_models_title')}
      </Text>

      {MODEL_FIELD_META.map((field) => {
        const providerKey = `${field.key}ProviderId` as keyof GlobalModelsConfig
        const modelKey = `${field.key}ModelId` as keyof GlobalModelsConfig
        const isSet = Boolean(globalModels[providerKey] && globalModels[modelKey])

        return (
          <TouchableOpacity
            key={field.key}
            style={[styles.routingCard, cardStyle]}
            activeOpacity={0.7}
            onPress={() => openSelector(field.key, field.forEmbedding)}
          >
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
                <MaterialCommunityIcons
                  name={field.icon}
                  size={20}
                  color={field.forEmbedding ? colors.error : colors.primary}
                />
              </View>
              <Text style={[styles.routeName, { color: colors.textPrimary }]}>
                {t(field.labelKey)}
              </Text>
            </View>

            <View
              style={[
                styles.selectorBtn,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: isSet ? colors.borderMuted : colors.borderSubtle
                }
              ]}
            >
              <Text
                style={[
                  styles.selectorValue,
                  { color: isSet ? colors.textPrimary : colors.textTertiary }
                ]}
                numberOfLines={2}
              >
                {isSet
                  ? getModelDisplay(providerKey, modelKey)
                  : t('models.click_to_assign', '点击分配默认处理模型')}
              </Text>
              <Text style={[styles.chevron, { color: colors.textTertiary }]}>›</Text>
            </View>
          </TouchableOpacity>
        )
      })}

      <TouchableOpacity
        style={[styles.linkCard, cardStyle]}
        onPress={() => router.push('/settings/ai-services')}
      >
        <Text style={[styles.linkText, { color: colors.primary }]}>
          {t('settings.configure_providers')}
        </Text>
      </TouchableOpacity>

      <ModelSwitcherPopup
        visible={activeSelector !== null}
        onClose={() => setActiveSelector(null)}
        models={popupModels}
        selectedModelId={popupSelectedId}
        onSelect={handleSelectModel}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: 12
  },
  pageHint: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20
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
  routeName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1
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
  },
  linkCard: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600'
  }
})
