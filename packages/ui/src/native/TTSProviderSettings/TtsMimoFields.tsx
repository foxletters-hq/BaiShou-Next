import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { Button } from '../Button'
import type { TtsProviderConfig } from './tts-provider-settings.types'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'
import {
  isMimoPresetModel,
  isMimoVoiceCloneModel,
  isMimoVoiceDesignModel,
  normalizeRefAudioPath
} from '@baishou/shared'

function getRefAudioDisplayName(path: string): string {
  const normalized = normalizeRefAudioPath(path)
  const parts = normalized.split(/[/\\]/)
  return parts[parts.length - 1] || normalized
}

interface TtsMimoFieldsProps {
  config: TtsProviderConfig
  onUpdate: (patch: Partial<TtsProviderConfig>) => void
  onPickRefAudio?: () => Promise<string | null>
  compact?: boolean
}

export const TtsMimoFields: React.FC<TtsMimoFieldsProps> = ({
  config,
  onUpdate,
  onPickRefAudio,
  compact = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const modelId = config.modelId || ''

  const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (compact) {
      return (
        <>
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.fieldGroupCard}>{children}</View>
        </>
      )
    }
    return (
      <View style={[styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]}>
        {children}
      </View>
    )
  }

  const handlePickRefAudio = async () => {
    if (!onPickRefAudio) return
    const picked = await onPickRefAudio()
    if (picked) {
      onUpdate({ refAudioPath: normalizeRefAudioPath(picked) })
    }
  }

  const stylePromptField = (
    <Section>
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
    </Section>
  )

  if (isMimoVoiceCloneModel(modelId)) {
    const refAudioPath = config.refAudioPath?.trim() ?? ''
    const refAudioName = refAudioPath ? getRefAudioDisplayName(refAudioPath) : ''

    return (
      <>
        <Section>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {onPickRefAudio
              ? t('tts.settings.mimo_ref_audio_label', '参考音频 (音色复刻)')
              : t('tts.settings.mimo_ref_audio_path_label')}
          </Text>
          {onPickRefAudio ? (
            <>
              <Button variant="outline" onPress={() => void handlePickRefAudio()}>
                <View style={styles.refAudioPickButtonContent}>
                  <MaterialIcons name="folder-open" size={18} color={colors.textSecondary} />
                  <Text style={[styles.refAudioPickButtonText, { color: colors.textPrimary }]}>
                    {refAudioPath
                      ? t('tts.settings.pick_ref_audio_again_button', '重新选择参考音频')
                      : t('tts.settings.pick_ref_audio_button', '选择参考音频')}
                  </Text>
                </View>
              </Button>
              {refAudioName ? (
                <Text
                  style={[styles.selectedRefAudioName, { color: colors.textSecondary }]}
                  numberOfLines={2}
                  ellipsizeMode="middle"
                >
                  {t('tts.settings.mimo_ref_audio_selected', {
                    name: refAudioName,
                    defaultValue: `已选择：${refAudioName}`
                  })}
                </Text>
              ) : null}
              <Text style={[styles.helperText, { color: colors.textTertiary, marginBottom: 0 }]}>
                {t(
                  'tts.settings.mimo_ref_audio_mobile_hint',
                  '点击按钮选择 wav/mp3 参考音频，将保存到外部存储'
                )}
              </Text>
            </>
          ) : (
            <>
              <Input
                style={styles.input}
                value={refAudioPath}
                onChangeText={(v) => onUpdate({ refAudioPath: normalizeRefAudioPath(v) })}
                placeholder={t('tts.settings.mimo_ref_audio_path_placeholder')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.helperText, { color: colors.textTertiary, marginBottom: 0 }]}>
                {t('tts.settings.mimo_ref_audio_hint')}
              </Text>
            </>
          )}
        </Section>
        {stylePromptField}
      </>
    )
  }

  if (isMimoVoiceDesignModel(modelId)) {
    return (
      <Section>
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
      </Section>
    )
  }

  if (isMimoPresetModel(modelId) || !modelId.trim()) {
    return stylePromptField
  }

  return null
}
