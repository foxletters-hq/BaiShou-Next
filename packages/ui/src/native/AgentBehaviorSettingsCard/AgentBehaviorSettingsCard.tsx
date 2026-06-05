import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native'
import { useNativeTheme } from '../theme'
import { NativeSlider } from '../Slider'
import { Input } from '../Input/Input'

export interface AgentBehaviorSettingsCardProps {
  config: {
    defaultSystemPrompt: string
    defaultTemperature: number
  }
  onChange: (config: { defaultSystemPrompt: string; defaultTemperature: number }) => void
}

export const AgentBehaviorSettingsCard: React.FC<AgentBehaviorSettingsCardProps> = ({
  config,
  onChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [expanded, setExpanded] = useState(false)

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(!expanded)
  }

  const tempDisplay = config.defaultTemperature.toFixed(1)

  return (
    <View
      style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.borderMuted }]}
    >
      <TouchableOpacity style={styles.header} onPress={toggleExpand} activeOpacity={0.7}>
        <Text style={styles.icon}>🧠</Text>
        <View style={styles.headerBody}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('settings.agent_behavior', '系统核心设定')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('settings.agent_behavior_desc', '自定义 AI 伙伴的基础行为与思考模式')}
          </Text>
        </View>
        <Text
          style={[
            styles.arrow,
            {
              color: colors.textSecondary,
              transform: [{ rotate: expanded ? '180deg' : '0deg' }]
            }
          ]}
        >
          ▼
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('settings.system_prompt', 'System Prompt')}
          </Text>
          <Input
            style={styles.promptInput}
            value={config.defaultSystemPrompt}
            onChangeText={(v) => onChange({ ...config, defaultSystemPrompt: v })}
            multiline
            textarea
            numberOfLines={6}
          />

          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('settings.temperature', '创造力 / 发散度')} ({tempDisplay})
          </Text>
          <View style={styles.slider}>
            <NativeSlider
              value={config.defaultTemperature}
              minValue={0}
              maxValue={2}
              step={0.1}
              onChange={(v) =>
                onChange({
                  ...config,
                  defaultTemperature: Math.round((v as number) * 10) / 10
                })
              }
            />
          </View>
          <View style={styles.rangeRow}>
            <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>
              {t('settings.temp_low', '保守')}
            </Text>
            <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>
              {t('settings.temp_mid', '平衡')}
            </Text>
            <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>
              {t('settings.temp_high', '创意')}
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16
  },
  icon: { fontSize: 24, marginRight: 16 },
  headerBody: { flex: 1 },
  title: { fontSize: 16, fontWeight: '500' },
  subtitle: { fontSize: 13, marginTop: 4 },
  arrow: { fontSize: 12 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  promptInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 140,
    lineHeight: 20
  },
  divider: { height: 1, marginVertical: 16 },
  slider: { width: '100%', paddingVertical: 8 },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4
  },
  rangeLabel: { fontSize: 11 }
})
