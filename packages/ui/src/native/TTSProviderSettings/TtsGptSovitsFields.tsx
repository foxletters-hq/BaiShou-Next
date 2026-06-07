import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { Select } from '../Select/Select'
import { Button } from '../Button'
import type { TtsProviderConfig } from './tts-provider-settings.types'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'

interface TtsGptSovitsFieldsProps {
  config: TtsProviderConfig
  langOptions: { value: string; label: string }[]
  onUpdate: (patch: Partial<TtsProviderConfig>) => void
}

export const TtsGptSovitsFields: React.FC<TtsGptSovitsFieldsProps> = ({
  config,
  langOptions,
  onUpdate
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const dividerStyle = [styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]

  return (
    <>
      <View style={dividerStyle}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.ref_audio_path_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.refAudioPath ?? ''}
          onChangeText={(v) => onUpdate({ refAudioPath: v })}
          placeholder={t('tts.settings.ref_audio_path_placeholder')}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={dividerStyle}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.prompt_text_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.promptText ?? ''}
          onChangeText={(v) => onUpdate({ promptText: v })}
          placeholder={t('tts.settings.prompt_text_placeholder')}
        />
      </View>

      <View style={dividerStyle}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.prompt_lang_label')}
        </Text>
        <Select
          options={langOptions}
          value={config.promptLang || 'zh'}
          onValueChange={(v) => onUpdate({ promptLang: v })}
        />
      </View>

      <View style={dividerStyle}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.text_lang_label')}
        </Text>
        <Select
          options={langOptions}
          value={config.textLang || 'zh'}
          onValueChange={(v) => onUpdate({ textLang: v })}
        />
      </View>
    </>
  )
}

interface TtsTestSectionProps {
  testText: string
  testing: boolean
  canTest: boolean
  onTestTextChange: (text: string) => void
  onTest: () => void
}

export const TtsTestSection: React.FC<TtsTestSectionProps> = ({
  testText,
  testing,
  canTest,
  onTestTextChange,
  onTest
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View style={[styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>
        {t('tts.settings.test_label')}
      </Text>
      <View style={styles.testRow}>
        <Input
          style={[styles.input, styles.testInput]}
          value={testText}
          onChangeText={onTestTextChange}
          placeholder={t('tts.settings.test_placeholder')}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button
          variant="outline"
          onPress={onTest}
          isLoading={testing}
          isDisabled={!canTest || testing}
          className="min-w-[72px] px-3.5"
        >
          {testing ? t('tts.settings.testing') : t('tts.settings.test_button')}
        </Button>
      </View>
    </View>
  )
}
