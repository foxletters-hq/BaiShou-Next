import React from 'react'
import { View, Text, TouchableOpacity, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import Slider from '@react-native-community/slider'
import { useNativeTheme } from '../theme'
import type { TtsProviderConfig } from './tts-provider-settings.types'
import { TTS_PROVIDERS, TTS_FORMATS } from './tts-provider-settings.constants'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'

interface TtsBasicFieldsProps {
  config: TtsProviderConfig
  showApiKey: boolean
  speedPercent: number
  onUpdate: (patch: Partial<TtsProviderConfig>) => void
  onProviderChange: (id: string) => void
  onToggleApiKey: () => void
}

export const TtsBasicFields: React.FC<TtsBasicFieldsProps> = ({
  config,
  showApiKey,
  speedPercent,
  onUpdate,
  onProviderChange,
  onToggleApiKey
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <>
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.provider', 'TTS 供应商')}
        </Text>
        <View style={styles.chipRow}>
          {TTS_PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.7}
              style={[
                styles.chip,
                {
                  borderColor: config.id === p.id ? colors.primary : colors.borderMuted,
                  backgroundColor: config.id === p.id ? colors.primaryLight : 'transparent'
                }
              ]}
              onPress={() => onProviderChange(p.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: config.id === p.id ? colors.primary : colors.textSecondary }
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.base_url', 'Base URL')}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bgSurfaceNormal,
              color: colors.textPrimary,
              borderColor: colors.borderMuted
            }
          ]}
          value={config.baseUrl}
          onChangeText={(v) => onUpdate({ baseUrl: v })}
          placeholder="https://api.openai.com/v1"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.api_key', 'API Key')}
        </Text>
        <View style={styles.apiKeyRow}>
          <TextInput
            style={[
              styles.input,
              styles.inputFlex,
              {
                backgroundColor: colors.bgSurfaceNormal,
                color: colors.textPrimary,
                borderColor: colors.borderMuted
              }
            ]}
            value={config.apiKey}
            onChangeText={(v) => onUpdate({ apiKey: v })}
            placeholder="sk-..."
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={!showApiKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.toggleBtn, { borderColor: colors.borderMuted }]}
            onPress={onToggleApiKey}
          >
            <Text style={[styles.toggleBtnText, { color: colors.textSecondary }]}>
              {showApiKey ? t('common.hide', '隐藏') : t('common.show', '显示')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.model_id', '模型 ID')}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bgSurfaceNormal,
              color: colors.textPrimary,
              borderColor: colors.borderMuted
            }
          ]}
          value={config.modelId}
          onChangeText={(v) => onUpdate({ modelId: v })}
          placeholder="tts-1"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.voice', '发音人 / Voice ID')}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bgSurfaceNormal,
              color: colors.textPrimary,
              borderColor: colors.borderMuted
            }
          ]}
          value={config.voice}
          onChangeText={(v) => onUpdate({ voice: v })}
          placeholder="alloy"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.speed', '语速')} ({speedPercent}%)
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={0.5}
          maximumValue={2.0}
          step={0.1}
          value={config.speed}
          onValueChange={(v) => onUpdate({ speed: v })}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.borderMuted}
          thumbTintColor={colors.primary}
        />
        <View style={styles.rangeRow}>
          <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>0.5x</Text>
          <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>2.0x</Text>
        </View>
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.response_format', '音频格式')}
        </Text>
        <View style={styles.chipRow}>
          {TTS_FORMATS.map((fmt) => (
            <TouchableOpacity
              key={fmt.id}
              activeOpacity={0.7}
              style={[
                styles.chip,
                {
                  borderColor:
                    config.responseFormat === fmt.id ? colors.primary : colors.borderMuted,
                  backgroundColor:
                    config.responseFormat === fmt.id ? colors.primaryLight : 'transparent'
                }
              ]}
              onPress={() => onUpdate({ responseFormat: fmt.id })}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: config.responseFormat === fmt.id ? colors.primary : colors.textSecondary
                  }
                ]}
              >
                {fmt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </>
  )
}
