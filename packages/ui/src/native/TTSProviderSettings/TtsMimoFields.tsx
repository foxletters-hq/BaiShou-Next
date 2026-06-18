import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import type { TtsProviderConfig } from './tts-provider-settings.types'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'
import {
  isMimoPresetModel,
  isMimoVoiceCloneModel,
  isMimoVoiceDesignModel
} from '@baishou/shared'

interface TtsMimoFieldsProps {
  config: TtsProviderConfig
  onUpdate: (patch: Partial<TtsProviderConfig>) => void
  compact?: boolean
}

export const TtsMimoFields: React.FC<TtsMimoFieldsProps> = ({
  config,
  onUpdate,
  compact = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const modelId = config.modelId || ''

  const dividerStyle = compact
    ? [styles.divider, { backgroundColor: colors.borderSubtle }]
    : [styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]

  const stylePromptField = (
    <View style={dividerStyle}>
      <Text style={[styles.label, { color: colors.textPrimary }]}>
        {t('tts.settings.mimo_style_prompt_label')}
      </Text>
      <Input
        style={styles.input}
        value={config.promptText ?? ''}
        onChangeText={(v) => onUpdate({ promptText: v })}
        placeholder={t('tts.settings.mimo_style_prompt_placeholder')}
      />
      <Text style={[styles.helperText, { color: colors.textTertiary }]}>
        {t('tts.settings.mimo_style_prompt_hint')}
      </Text>
    </View>
  )

  if (isMimoVoiceCloneModel(modelId)) {
    return (
      <>
        <View style={dividerStyle}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('tts.settings.mimo_ref_audio_path_label')}
          </Text>
          <Input
            style={styles.input}
            value={config.refAudioPath ?? ''}
            onChangeText={(v) => onUpdate({ refAudioPath: v })}
            placeholder={t('tts.settings.mimo_ref_audio_path_placeholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.helperText, { color: colors.textTertiary }]}>
            {t('tts.settings.mimo_ref_audio_hint')}
          </Text>
        </View>
        {stylePromptField}
      </>
    )
  }

  if (isMimoVoiceDesignModel(modelId)) {
    return (
      <View style={dividerStyle}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.mimo_voice_design_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.promptText ?? ''}
          onChangeText={(v) => onUpdate({ promptText: v })}
          placeholder={t('tts.settings.mimo_voice_design_placeholder')}
        />
        <Text style={[styles.helperText, { color: colors.textTertiary }]}>
          {t('tts.settings.mimo_voice_design_hint')}
        </Text>
      </View>
    )
  }

  if (isMimoPresetModel(modelId) || !modelId.trim()) {
    return stylePromptField
  }

  return null
}
