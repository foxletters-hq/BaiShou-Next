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
          {t('tts.ref_audio_path', '参考音频路径')}
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
          {t('tts.prompt_text', '提示文本')}
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
          {t('tts.prompt_lang', '提示语言')}
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
          {t('tts.text_lang', '文本语言')}
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
        {t('tts.test_text', '测试文本')}
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
