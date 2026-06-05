import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import type { TtsProviderConfig } from './tts-provider-settings.types'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'

interface TtsGptSovitsFieldsProps {
  config: TtsProviderConfig
  onUpdate: (patch: Partial<TtsProviderConfig>) => void
}

export const TtsGptSovitsFields: React.FC<TtsGptSovitsFieldsProps> = ({ config, onUpdate }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <>
      <View style={[styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.ref_audio_path_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.refAudioPath ?? ''}
          onChangeText={(v) => onUpdate({ refAudioPath: v })}
          placeholder="/path/to/ref.wav"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={[styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.prompt_text_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.promptText ?? ''}
          onChangeText={(v) => onUpdate({ promptText: v })}
          placeholder="..."
        />
      </View>

      <View style={[styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.prompt_lang_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.promptLang ?? ''}
          onChangeText={(v) => onUpdate({ promptLang: v })}
          placeholder="zh"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={[styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.text_lang_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.textLang ?? ''}
          onChangeText={(v) => onUpdate({ textLang: v })}
          placeholder="zh"
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
    <View style={[styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>
        {t('tts.settings.test_label')}
      </Text>
      <Input
        style={[styles.input, styles.multilineInput]}
        value={testText}
        onChangeText={onTestTextChange}
        multiline
        textarea
        numberOfLines={3}
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
