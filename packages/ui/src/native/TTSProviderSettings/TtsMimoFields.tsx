import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Volume2 } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { Input } from '../Input/Input'
import { Button } from '../Button'
import type { TtsProviderConfig } from './tts-provider-settings.types'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'
import { sharedTokens, mobileControlTokens } from '../../theme/tokens'
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
  onPickRefAudio?: () => Promise<import('@baishou/shared').TtsRefAudioPickValue | null>
  onPlayRefAudio?: (audioBase64: string, format: string) => Promise<void>
  compact?: boolean
}

export const TtsMimoFields: React.FC<TtsMimoFieldsProps> = ({
  config,
  onUpdate,
  onPickRefAudio,
  onPlayRefAudio,
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
    await onPickRefAudio()
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
    const refAudioBase64 = config.refAudioBase64?.trim() ?? ''
    const refPlaybackFormat = refAudioPath.toLowerCase().endsWith('.wav') ? 'wav' : 'mp3'

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
              <TouchableOpacity
                style={[
                  styles.refAudioCard,
                  {
                    borderColor: refAudioPath ? colors.primary : colors.borderSubtle,
                    backgroundColor: refAudioPath ? colors.primaryLight : colors.bgSurfaceNormal
                  }
                ]}
                onPress={() => void handlePickRefAudio()}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <View style={[styles.targetIcon, { backgroundColor: colors.bgSurface }]}>
                  <FolderOpen
                    size={24}
                    color={refAudioPath ? colors.primary : colors.textSecondary}
                    strokeWidth={2}
                  />
                </View>
                <View style={styles.targetCardContent}>
                  <Text
                    style={[
                      styles.targetTitle,
                      { color: refAudioPath ? colors.primary : colors.textPrimary }
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {refAudioName || t('tts.settings.pick_ref_audio_button', '选择参考音频')}
                  </Text>
                  <Text
                    style={[styles.targetDesc, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {refAudioPath
                      ? t('tts.settings.pick_ref_audio_again_hint', '点击可重新选择或替换音频文件')
                      : t(
                          'tts.settings.mimo_ref_audio_mobile_hint',
                          '支持 wav / mp3 格式参考音频，将保存到外部存储'
                        )}
                  </Text>
                </View>
              </TouchableOpacity>
              {refAudioBase64 && onPlayRefAudio ? (
                <Button
                  variant="outline"
                  style={{
                    marginTop: sharedTokens.spacing.xs,
                    marginBottom: sharedTokens.spacing.xs,
                    minHeight: mobileControlTokens.height
                  }}
                  onPress={() => void onPlayRefAudio(refAudioBase64, refPlaybackFormat)}
                >
                  <View style={styles.refAudioPickButtonContent}>
                    <Volume2
                      size={18}
                      color={colors.textSecondary}
                      strokeWidth={DEFAULT_STROKE_WIDTH}
                    />
                    <Text style={[styles.refAudioPickButtonText, { color: colors.textPrimary }]}>
                      {t('tts.settings.preview_ref_audio_button', '试听参考音频')}
                    </Text>
                  </View>
                </Button>
              ) : null}
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
