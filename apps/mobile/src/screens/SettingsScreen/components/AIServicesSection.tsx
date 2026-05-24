import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/src/native/theme'
import { useBaishou } from '../../providers/BaishouProvider'
import { AIProviderConfig } from '@baishou/shared'

export const AIServicesSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [providers, setProviders] = useState<AIProviderConfig[]>([])

  useEffect(() => {
    if (!dbReady || !services) return
    const loadProviders = async () => {
      try {
        const providerList =
          (await services.settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
        setProviders(providerList)
      } catch (e) {
        console.warn('Load providers failed', e)
      }
    }
    loadProviders()
  }, [dbReady, services])

  const handleAddProvider = async () => {
    if (!services || !dbReady) return
    Alert.prompt(
      t('settings.add_provider_title', '添加供应商'),
      t('settings.add_provider_message', '请输入新供应商ID (如 provider-openai):'),
      async (newId) => {
        if (!newId?.trim()) return
        try {
          const providerList = (await services.settingsManager.get<any[]>('ai_providers')) || []
          if (providerList.some((p) => p.id === newId.trim())) {
            Alert.alert(t('common.error', '错误'), t('settings.provider_exists', '供应商ID已存在'))
            return
          }
          const newProvider = {
            id: newId.trim(),
            name: newId.trim(),
            type: 'custom',
            apiKey: '',
            baseUrl: '',
            models: [],
            enabledModels: [],
            isEnabled: true,
            isSystem: false,
            sortOrder: providerList.length + 1
          }
          providerList.push(newProvider)
          await services.settingsManager.set('ai_providers', providerList)
          setProviders([...providerList])
          Alert.alert(t('common.success', '成功'), t('settings.provider_added', '供应商已添加'))
        } catch (e) {
          Alert.alert(t('common.error', '错误'), t('settings.provider_add_failed', '添加失败'))
        }
      },
      'plain-text'
    )
  }

  const handleDeleteProvider = async (index: number) => {
    if (!services || !dbReady) return
    const provider = providers[index]
    if (provider.isSystem) {
      Alert.alert(
        t('common.hint', '提示'),
        t('settings.cannot_delete_system', '系统供应商不可删除')
      )
      return
    }
    Alert.alert(
      t('settings.delete_provider_confirm_title', '确认删除'),
      t('settings.delete_provider_confirm_message', '确定删除供应商 "{name}" 吗？').replace(
        '{name}',
        provider.name
      ),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.delete', '删除'),
          style: 'destructive',
          onPress: async () => {
            const newProviders = providers.filter((_, i) => i !== index)
            await services.settingsManager.set('ai_providers', newProviders)
            setProviders(newProviders)
          }
        }
      ]
    )
  }

  const handleTestConnection = async (providerIndex: number) => {
    if (!services || !dbReady) return
    const provider = providers[providerIndex]
    if (!provider.apiKey) {
      Alert.alert(t('common.hint', '提示'), t('settings.need_api_key', '请先配置 API Key'))
      return
    }
    try {
      Alert.alert(t('common.hint', '提示'), t('settings.testing_connection', '正在测试连接...'))
      const response = await fetch(`${provider.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${provider.apiKey}` }
      })
      if (response.ok) {
        Alert.alert(t('common.success', '成功'), t('settings.connection_ok', '连接成功'))
      } else {
        Alert.alert(
          t('common.error', '错误'),
          t('settings.connection_failed_with_status', '连接失败 ({status})').replace(
            '{status}',
            String(response.status)
          )
        )
      }
    } catch (e: any) {
      Alert.alert(
        t('common.error', '错误'),
        t('settings.connection_failed', '连接失败: {message}').replace('{message}', e.message || '')
      )
    }
  }

  const handleFetchModels = async (providerIndex: number) => {
    if (!services || !dbReady) return
    const provider = providers[providerIndex]
    if (!provider.apiKey) {
      Alert.alert(t('common.hint', '提示'), t('settings.need_api_key', '请先配置 API Key'))
      return
    }
    try {
      Alert.alert(t('common.hint', '提示'), t('settings.testing_connection', '正在获取模型列表...'))
      const response = await fetch(`${provider.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${provider.apiKey}` }
      })
      if (response.ok) {
        const data = await response.json()
        const models = (data.data || []).map((m: any) => m.id)
        const newProviders = [...providers]
        newProviders[providerIndex] = {
          ...newProviders[providerIndex],
          models
        }
        await services.settingsManager.set('ai_providers', newProviders)
        setProviders(newProviders)
        Alert.alert(
          t('common.success', '成功'),
          t('settings.models_fetched', '获取到 {count} 个模型').replace(
            '{count}',
            String(models.length)
          )
        )
      } else {
        Alert.alert(
          t('common.error', '错误'),
          t('settings.fetch_models_failed', '获取模型列表失败')
        )
      }
    } catch (e: any) {
      Alert.alert(
        t('common.error', '错误'),
        t('settings.fetch_models_failed_msg', '获取失败: {message}').replace(
          '{message}',
          e.message || ''
        )
      )
    }
  }

  return (
    <View style={styles.section}>
      {providers.map((provider, index) => (
        <View
          key={index}
          style={[styles.providerItem, { backgroundColor: colors.bgSurfaceHighest }]}
        >
          <View style={styles.providerHeader}>
            <Text style={[styles.providerName, { color: colors.textPrimary }]}>
              {provider.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {!provider.isSystem && (
                <TouchableOpacity
                  onPress={() => handleDeleteProvider(index)}
                  style={{ padding: 4 }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>
              )}
              <Switch
                value={provider.isEnabled}
                onValueChange={async (value) => {
                  const newProviders = [...providers]
                  newProviders[index] = {
                    ...newProviders[index],
                    isEnabled: value
                  }
                  await services?.settingsManager.set('ai_providers', newProviders)
                  setProviders(newProviders)
                }}
              />
            </View>
          </View>
          {provider.isSystem && (
            <Text style={[styles.providerType, { color: colors.primary, fontSize: 11 }]}>
              🔒 系统核心
            </Text>
          )}
          {!provider.isSystem && (
            <Text style={[styles.providerType, { color: colors.textSecondary }]}>
              类型: {provider.type}
            </Text>
          )}
          <TextInput
            style={[
              styles.providerInput,
              {
                backgroundColor: colors.bgSurface,
                color: colors.textPrimary,
                borderColor: colors.borderSubtle
              }
            ]}
            value={provider.apiKey}
            onChangeText={async (text) => {
              const newProviders = [...providers]
              newProviders[index] = { ...newProviders[index], apiKey: text }
              await services?.settingsManager.set('ai_providers', newProviders)
              setProviders(newProviders)
            }}
            placeholder="API Key"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
          />
          <TextInput
            style={[
              styles.providerInput,
              {
                backgroundColor: colors.bgSurface,
                color: colors.textPrimary,
                borderColor: colors.borderSubtle
              }
            ]}
            value={provider.baseUrl}
            onChangeText={async (text) => {
              const newProviders = [...providers]
              newProviders[index] = { ...newProviders[index], baseUrl: text }
              await services?.settingsManager.set('ai_providers', newProviders)
              setProviders(newProviders)
            }}
            placeholder="Base URL"
            placeholderTextColor={colors.textSecondary}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: colors.bgSurface }]}
              onPress={() => handleTestConnection(index)}
            >
              <Text style={[styles.smallActionBtnText, { color: colors.textPrimary }]}>
                {t('settings.test_connection', '测试连接')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: colors.bgSurface }]}
              onPress={() => handleFetchModels(index)}
            >
              <Text style={[styles.smallActionBtnText, { color: colors.textPrimary }]}>
                {t('settings.fetch_models', '获取模型')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 12 }]}
        onPress={handleAddProvider}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>
          + {t('settings.add_provider', '添加供应商')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  providerItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600'
  },
  providerType: {
    fontSize: 12,
    marginBottom: 12
  },
  providerInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 8
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
  },
  smallActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  smallActionBtnText: {
    fontSize: 12,
    fontWeight: '600'
  }
})
