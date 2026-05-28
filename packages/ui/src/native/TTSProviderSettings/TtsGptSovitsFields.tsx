import React from 'react'
import { View, Text, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { TtsProviderConfig } from './tts-provider-settings.types'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'

interface TtsGptSovitsFieldsProps {
  config: TtsProviderConfig
  onUpdate: (patch: Partial<TtsProviderConfig>) => void
}

export const TtsGptSovitsFields: React.FC<TtsGptSovitsFieldsProps> = ({ config, onUpdate }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.bgSurfaceNormal,
      color: colors.textPrimary,
      borderColor: colors.borderMuted
    }
  ]

  return (
    <>
      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.ref_audio_path_label')}
        </Text>
        <TextInput
          style={inputStyle}
          value={config.refAudioPath ?? ''}
          onChangeText={(v) => onUpdate({ refAudioPath: v })}
          placeholder="/path/to/ref.wav"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.prompt_text_label')}
        </Text>
        <TextInput
          style={inputStyle}
          value={config.promptText ?? ''}
          onChangeText={(v) => onUpdate({ promptText: v })}
          placeholder="..."
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.prompt_lang_label')}
        </Text>
        <TextInput
          style={inputStyle}
          value={config.promptLang ?? ''}
          onChangeText={(v) => onUpdate({ promptLang: v })}
          placeholder="zh"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.text_lang_label')}
        </Text>
        <TextInput
          style={inputStyle}
          value={config.textLang ?? ''}
          onChangeText={(v) => onUpdate({ textLang: v })}
          placeholder="zh"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </>
  )
}

interface TtsTestSectionProps {
  testText: string
  testResult: string | null
  onTestTextChange: (text: string) => void
}

export const TtsTestSection: React.FC<TtsTestSectionProps> = ({
  testText,
  testResult,
  onTestTextChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View style={[styles.fieldGroup, { borderTopColor: colors.borderSubtle }]}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>
        {t('tts.settings.test_label')}
      </Text>
      <TextInput
        style={[
          styles.input,
          styles.multilineInput,
          {
            backgroundColor: colors.bgSurfaceNormal,
            color: colors.textPrimary,
            borderColor: colors.borderMuted
          }
        ]}
        value={testText}
        onChangeText={onTestTextChange}
        multiline
        numberOfLines={3}
        placeholderTextColor={colors.textTertiary}
      />

      {testResult && (
        <Text
          style={[
            styles.resultText,
            {
              color: testResult.includes('成功') ? colors.success : colors.error
            }
          ]}
        >
          {testResult}
        </Text>
      )}
    </View>
  )
}
