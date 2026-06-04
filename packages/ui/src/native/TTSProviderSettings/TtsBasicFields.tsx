import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import Slider from '@react-native-community/slider'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import type { TtsProviderConfig } from './tts-provider-settings.types'
import { TTS_PROVIDERS, TTS_FORMATS } from './tts-provider-settings.constants'

const PROVIDER_I18N: Record<string, string> = {
  'openai-tts': 'tts.settings.provider_openai',
  'mimo-tts': 'tts.settings.provider_mimo',
  'clone-tts': 'tts.settings.provider_clone',
  'gpt-sovits': 'tts.settings.provider_gpt_sovits'
}
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
          {t('tts.settings.provider_label')}
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
                {t(PROVIDER_I18N[p.id] ?? 'tts.settings.provider_openai')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.base_url_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.baseUrl}
          onChangeText={(v) => onUpdate({ baseUrl: v })}
          placeholder="https://api.openai.com/v1"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.api_key_label')}
        </Text>
        <View style={styles.apiKeyRow}>
          <Input
            style={[styles.input, styles.inputFlex]}
            value={config.apiKey}
            onChangeText={(v) => onUpdate({ apiKey: v })}
            placeholder="sk-..."
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
              {showApiKey ? t('common.hide') : t('common.show')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.model_id_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.modelId}
          onChangeText={(v) => onUpdate({ modelId: v })}
          placeholder="tts-1"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.voice_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.voice}
          onChangeText={(v) => onUpdate({ voice: v })}
          placeholder="alloy"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.speed_label')} ({speedPercent}%)
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
          {t('tts.settings.format_label')}
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
