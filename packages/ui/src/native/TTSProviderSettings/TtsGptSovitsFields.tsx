import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { FolderOpen } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { normalizeRefAudioPath, parseRefAudioPick } from '@baishou/shared'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
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
                  strokeWidth={DEFAULT_STROKE_WIDTH}
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
                        '点击选择 wav/mp3 参考音频，将保存到外部存储'
                      )}
                </Text>
              </View>
            </TouchableOpacity>
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
        <View style={styles.inlineFieldRow}>
          <Text style={[styles.label, styles.labelInline, { color: colors.textPrimary }]}>
            {t('tts.settings.prompt_lang_label')}
          </Text>
          <Select
            variant="settings"
            compact
            options={langOptions}
            value={config.promptLang || 'zh'}
            onValueChange={(v) => onUpdate({ promptLang: v })}
            triggerStyle={styles.compactSelectTrigger}
          />
        </View>
      </Section>

      <Section>
        <View style={styles.inlineFieldRow}>
          <Text style={[styles.label, styles.labelInline, { color: colors.textPrimary }]}>
            {t('tts.settings.text_lang_label')}
          </Text>
          <Select
            variant="settings"
            compact
            options={langOptions}
            value={config.textLang || 'zh'}
            onValueChange={(v) => onUpdate({ textLang: v })}
            triggerStyle={styles.compactSelectTrigger}
          />
        </View>
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
              style={styles.actionButton}
            >
              {testing ? t('tts.settings.testing') : t('tts.settings.test_button')}
            </Button>
          </View>
        </View>
      </View>
    </View>
  )
}
