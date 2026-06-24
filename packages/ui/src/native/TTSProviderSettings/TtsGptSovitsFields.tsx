import React from 'react'
import { View, Text } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { normalizeRefAudioPath, parseRefAudioPick } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import { Select } from '../Select/Select'
import { Button } from '../Button'
import type { TtsProviderConfig } from './tts-provider-settings.types'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'

function getRefAudioDisplayName(path: string): string {
  const normalized = normalizeRefAudioPath(path)
  const parts = normalized.split(/[/\\]/)
  return parts[parts.length - 1] || normalized
}

interface TtsGptSovitsFieldsProps {
  config: TtsProviderConfig
  langOptions: { value: string; label: string }[]
  onUpdate: (patch: Partial<TtsProviderConfig>) => void
  onPickRefAudio?: () => Promise<import('@baishou/shared').TtsRefAudioPickValue | null>
  compact?: boolean
}

export const TtsGptSovitsFields: React.FC<TtsGptSovitsFieldsProps> = ({
  config,
  langOptions,
  onUpdate,
  onPickRefAudio,
  compact = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const refAudioPath = config.refAudioPath?.trim() ?? ''
  const refAudioName = refAudioPath ? getRefAudioDisplayName(refAudioPath) : ''

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
    const parsed = parseRefAudioPick(picked)
    if (parsed) {
      onUpdate({ refAudioPath: parsed.path })
    }
  }

  return (
    <>
      <Section>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.ref_audio_path_label')}
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
          <Input
            style={styles.input}
            value={refAudioPath}
            onChangeText={(v) => onUpdate({ refAudioPath: normalizeRefAudioPath(v) })}
            placeholder={t('tts.settings.ref_audio_path_placeholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      </Section>

      <Section>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.prompt_text_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.promptText ?? ''}
          onChangeText={(v) => onUpdate({ promptText: v })}
          placeholder={t('tts.settings.prompt_text_placeholder')}
        />
      </Section>

      <Section>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.prompt_lang_label')}
        </Text>
        <Select
          options={langOptions}
          value={config.promptLang || 'zh'}
          onValueChange={(v) => onUpdate({ promptLang: v })}
        />
      </Section>

      <Section>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.text_lang_label')}
        </Text>
        <Select
          options={langOptions}
          value={config.textLang || 'zh'}
          onValueChange={(v) => onUpdate({ textLang: v })}
        />
      </Section>
    </>
  )
}

interface TtsTestSectionProps {
  testText: string
  testing: boolean
  canTest: boolean
  onTestTextChange: (text: string) => void
  onTest: () => void
  compact?: boolean
}

export const TtsTestSection: React.FC<TtsTestSectionProps> = ({
  testText,
  testing,
  canTest,
  onTestTextChange,
  onTest,
  compact = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const wrapStyle = compact
    ? [styles.divider, { backgroundColor: colors.borderSubtle }]
    : [styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]

  return (
    <View>
      {compact ? <View style={wrapStyle} /> : null}
      <View style={compact ? styles.fieldGroupCard : wrapStyle}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.test_label')}
        </Text>
        <View style={styles.testRow}>
          <View style={styles.testInputWrap}>
            <Input
              style={styles.input}
              className="min-w-0 w-full"
              value={testText}
              onChangeText={onTestTextChange}
              placeholder={t('tts.settings.test_placeholder')}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.testButtonWrap}>
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
      </View>
    </View>
  )
}
