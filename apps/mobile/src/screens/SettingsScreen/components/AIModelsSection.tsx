import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/src/native/theme'
import { useBaishou } from '../../providers/BaishouProvider'
import { AIProviderConfig } from '@baishou/shared'

export interface AIModelsSectionProps {
  setActiveTab: (tabId: string) => void
}

export const AIModelsSection: React.FC<AIModelsSectionProps> = ({ setActiveTab }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [providers, setProviders] = useState<AIProviderConfig[]>([])
  const [globalModels, setGlobalModels] = useState<any>({})

  useEffect(() => {
    if (!dbReady || !services) return
    const loadConfig = async () => {
      try {
        const providerList =
          (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
        setProviders(providerList)
        const globalModelsConfig = (await services.settingsManager.get<any>('global_models')) || {}
        setGlobalModels(globalModelsConfig)
      } catch (e) {
        console.warn('Load models config failed', e)
      }
    }
    loadConfig()
  }, [dbReady, services])

  const handleSaveGlobalModels = async (config: any) => {
    if (!services || !dbReady) return
    try {
      await services.settingsManager.set('global_models', config)
      setGlobalModels(config)
      Alert.alert(
        t('common.success', '成功'),
        t('settings.global_models_saved', '全局模型配置已保存')
      )
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'))
    }
  }

  const enabledProviders = providers.filter((p) => p.isEnabled && p.models?.length > 0)
  const allModels: { providerId: string; modelId: string; label: string }[] = []
  enabledProviders.forEach((p) => {
    ;(p.models || []).forEach((m: string) => {
      allModels.push({
        providerId: p.id,
        modelId: m,
        label: `${p.name} / ${m}`
      })
    })
  })

  const selectModel = async (key: string, currentProviderId: string, currentModelId: string) => {
    const allModelOptions = allModels.map((m) => m.label)
    if (allModelOptions.length === 0) {
      Alert.alert(
        t('common.hint', '提示'),
        t('settings.no_models_available', '没有可用的模型，请先配置供应商')
      )
      return
    }
    const buttons: Array<{
      text: string
      onPress?: () => void
      style?: 'default' | 'cancel' | 'destructive'
    }> = allModels.map((selected) => ({
      text: selected.label,
      onPress: async () => {
        const newConfig = {
          ...globalModels,
          [`${key}ProviderId`]: selected.providerId,
          [`${key}ModelId`]: selected.modelId
        }
        await handleSaveGlobalModels(newConfig)
      }
    }))
    buttons.push({ text: t('common.cancel', '取消'), style: 'cancel' })
    Alert.alert(t('settings.select_model', '选择模型'), '', buttons)
  }

  const modelFields = [
    {
      key: 'globalDialogue',
      label: t('settings.dialogue_model', '对话模型'),
      icon: '💬'
    },
    {
      key: 'globalNaming',
      label: t('settings.naming_model', '命名模型'),
      icon: '✏️'
    },
    {
      key: 'globalEmbedding',
      label: t('settings.embedding_model', '嵌入模型'),
      icon: '🧬'
    },
    {
      key: 'globalSummary',
      label: t('settings.summary_model', '总结模型'),
      icon: '📊'
    }
  ]

  const getModelDisplay = (providerKey: string, modelKey: string) => {
    const pid = globalModels[providerKey]
    const mid = globalModels[modelKey]
    if (pid && mid) {
      const prov = providers.find((p) => p.id === pid)
      return prov ? `${prov.name} / ${mid}` : mid
    }
    return t('settings.not_set', '未设置')
  }

  return (
    <View style={styles.section}>
      {modelFields.map((field) => (
        <TouchableOpacity
          key={field.key}
          style={[styles.modelPickerItem, { backgroundColor: colors.bgSurfaceHighest }]}
          onPress={() =>
            selectModel(
              field.key,
              globalModels[`${field.key}ProviderId`] || '',
              globalModels[`${field.key}ModelId`] || ''
            )
          }
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 18 }}>{field.icon}</Text>
            <View>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
                {field.label}
              </Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {getModelDisplay(`${field.key}ProviderId`, `${field.key}ModelId`)}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.bgSurface }]}
        onPress={() => setActiveTab('ai-services')}
      >
        <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
          {t('settings.configure_providers', '配置供应商')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  modelPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  settingValue: {
    fontSize: 14
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600'
  }
})
