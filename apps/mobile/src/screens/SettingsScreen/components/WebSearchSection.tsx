import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/src/native/theme'
import { useBaishou } from '../../providers/BaishouProvider'

export const WebSearchSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [webSearchConfig, setWebSearchConfig] = useState<any>({})

  useEffect(() => {
    if (!dbReady || !services) return
    const loadConfig = async () => {
      try {
        const webSearchConfigData =
          (await services.settingsManager.get<any>('web_search_config')) || {}
        setWebSearchConfig(webSearchConfigData)
      } catch (e) {
        console.warn('Load web search config failed', e)
      }
    }
    loadConfig()
  }, [dbReady, services])

  const handleSaveWebSearchConfig = async (config: any) => {
    if (!services || !dbReady) return
    try {
      await services.settingsManager.set('web_search_config', config)
      setWebSearchConfig(config)
      Alert.alert(t('common.success', '成功'), t('settings.web_search_saved', '网络搜索配置已保存'))
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.save_failed', '保存失败'))
    }
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('settings.web_search_title', '网络搜索设置')}
      </Text>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.web_search_enabled', '启用网络搜索')}
        </Text>
        <Switch
          value={webSearchConfig.enabled || false}
          onValueChange={(value) =>
            handleSaveWebSearchConfig({ ...webSearchConfig, enabled: value })
          }
        />
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.search_engine', '搜索引擎')}
        </Text>
        <View style={styles.settingRow}>
          {['duckduckgo', 'tavily'].map((engine) => (
            <TouchableOpacity
              key={engine}
              style={[
                styles.chipButton,
                {
                  backgroundColor:
                    (webSearchConfig.provider || 'duckduckgo') === engine
                      ? colors.primary
                      : colors.bgSurface
                }
              ]}
              onPress={() =>
                handleSaveWebSearchConfig({
                  ...webSearchConfig,
                  provider: engine
                })
              }
            >
              <Text
                style={[
                  styles.chipButtonText,
                  {
                    color:
                      (webSearchConfig.provider || 'duckduckgo') === engine
                        ? '#FFF'
                        : colors.textSecondary
                  }
                ]}
              >
                {engine}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.max_search_results', '最大搜索结果')}: {webSearchConfig.maxResults || 5}
        </Text>
        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>1</Text>
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <View style={styles.stepsRow}>
              {[1, 3, 5, 10, 15, 20, 30].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor:
                        (webSearchConfig.maxResults || 5) === n ? colors.primary : colors.bgSurface
                    },
                    { borderColor: colors.borderSubtle }
                  ]}
                  onPress={() =>
                    handleSaveWebSearchConfig({
                      ...webSearchConfig,
                      maxResults: n
                    })
                  }
                >
                  <Text
                    style={[
                      styles.stepDotText,
                      {
                        color:
                          (webSearchConfig.maxResults || 5) === n ? '#FFF' : colors.textSecondary
                      }
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>30</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  settingItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
  },
  settingRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  chipButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  chipButtonText: {
    fontSize: 13,
    fontWeight: '600'
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  sliderLabel: {
    fontSize: 12,
    width: 24,
    textAlign: 'center'
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  stepDot: {
    width: 32,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: '600'
  }
})
