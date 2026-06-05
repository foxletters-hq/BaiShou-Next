import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { NativeSlider } from '../Slider'
import { Input } from '../Input/Input'
import { Button } from '../Button'
import { useDialog } from '../Dialog'
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
  showApiKeyField: boolean
  apiKeyOptional: boolean
  canFetchModels: boolean
  loadingModels: boolean
  modelOptions: string[]
  onUpdate: (patch: Partial<TtsProviderConfig>) => void
  onProviderChange: (id: string) => void
  onToggleApiKey: () => void
  onFetchModels: () => void
  onSelectModel: (modelId: string) => void
}

export const TtsBasicFields: React.FC<TtsBasicFieldsProps> = ({
  config,
  showApiKey,
  speedPercent,
  showApiKeyField,
  apiKeyOptional,
  canFetchModels,
  loadingModels,
  modelOptions,
  onUpdate,
  onProviderChange,
  onToggleApiKey,
  onFetchModels,
  onSelectModel
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const dialog = useDialog()

  const dividerStyle = [styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]

  const modelPlaceholder =
    config.id === 'clone-tts' || config.id === 'gpt-sovits'
      ? 'default'
      : config.id === 'mimo-tts'
        ? 'mimo-v2.5-tts'
        : 'tts-1'

  const baseUrlPlaceholder =
    config.id === 'clone-tts'
      ? 'http://127.0.0.1:8080'
      : config.id === 'gpt-sovits'
        ? 'http://127.0.0.1:9880'
        : config.id === 'mimo-tts'
          ? t('tts.settings.mimo_base_url_placeholder')
          : 'https://api.openai.com/v1'

  const handlePickModel = async () => {
    const picked = await dialog.choose(
      t('tts.settings.model_id_label'),
      modelOptions.map((modelId) => ({ label: modelId, value: modelId }))
    )
    if (picked) onSelectModel(picked)
  }

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

      <View style={dividerStyle}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.base_url_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.baseUrl}
          onChangeText={(v) => onUpdate({ baseUrl: v })}
          placeholder={baseUrlPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {showApiKeyField && (
        <View style={dividerStyle}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {apiKeyOptional
              ? t('tts.settings.api_key_optional_label')
              : t('tts.settings.api_key_label')}
          </Text>
          {apiKeyOptional && (
            <Text style={[styles.helperText, { color: colors.textTertiary }]}>
              {t('tts.settings.api_key_optional_hint')}
            </Text>
          )}
          <Input
            style={styles.input}
            value={config.apiKey}
            onChangeText={(v) => onUpdate({ apiKey: v })}
            placeholder={t('tts.settings.api_key_placeholder')}
            secureTextEntry={!showApiKey}
            autoCapitalize="none"
            autoCorrect={false}
            rightSlot={
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onToggleApiKey}
                style={styles.visibilityToggle}
                accessibilityLabel={showApiKey ? t('common.hide') : t('common.show')}
              >
                <MaterialIcons
                  name={showApiKey ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            }
          />
        </View>
      )}

      <View style={dividerStyle}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.model_id_label')}
        </Text>
        <View style={styles.modelRow}>
          <Input
            style={[styles.input, styles.modelInput]}
            value={config.modelId}
            onChangeText={(v) => onUpdate({ modelId: v })}
            placeholder={modelPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            rightSlot={
              modelOptions.length > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => void handlePickModel()}
                  style={styles.visibilityToggle}
                  accessibilityLabel={t('tts.settings.model_id_label')}
                >
                  <MaterialIcons name="arrow-drop-down" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : undefined
            }
          />
          {canFetchModels && (
            <Button
              variant="outline"
              onPress={onFetchModels}
              isLoading={loadingModels}
              isDisabled={loadingModels}
              className="min-w-[72px] px-3.5"
            >
              {loadingModels ? t('tts.settings.fetching_models') : t('tts.settings.fetch_models')}
            </Button>
          )}
        </View>
      </View>

      <View style={dividerStyle}>
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

      <View style={dividerStyle}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.speed_label')} ({speedPercent}%)
        </Text>
        <NativeSlider
          value={config.speed}
          minValue={0.5}
          maxValue={2.0}
          step={0.1}
          onChange={(v) => onUpdate({ speed: v as number })}
        />
        <View style={styles.rangeRow}>
          <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>0.5x</Text>
          <Text style={[styles.rangeLabel, { color: colors.textTertiary }]}>2.0x</Text>
        </View>
      </View>

      <View style={dividerStyle}>
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
