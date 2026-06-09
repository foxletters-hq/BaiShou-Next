import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import { NativeSlider } from '../Slider'
import { Input } from '../Input/Input'
import { Select } from '../Select/Select'
import { Button } from '../Button'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import type { TtsProviderConfig } from './tts-provider-settings.types'
import { TtsModelCombobox } from './TtsModelCombobox'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'

interface TtsBasicFieldsProps {
  layout?: 'section' | 'groupCard'
  config: TtsProviderConfig
  providerOptions: { value: string; label: string }[]
  formatOptions: { value: string; label: string }[]
  showApiKey: boolean
  showApiKeyField: boolean
  apiKeyOptional: boolean
  canFetchModels: boolean
  loadingModels: boolean
  modelPlaceholder: string
  voicePlaceholder: string
  getModelOptions: () => string[]
  isModelDropdownOpen: boolean
  showAllModelOptions: boolean
  onUpdate: (patch: Partial<TtsProviderConfig>) => void
  onProviderChange: (id: string) => void
  onToggleApiKey: () => void
  onFetchModels: () => void
  onSelectModel: (modelId: string) => void
  onModelDropdownOpen: () => void
  onModelDropdownToggle: () => void
  onModelTextChange: (text: string) => void
  showSpeedControl: boolean
}

export const TtsBasicFields: React.FC<TtsBasicFieldsProps> = ({
  layout = 'section',
  config,
  providerOptions,
  formatOptions,
  showApiKey,
  showApiKeyField,
  apiKeyOptional,
  canFetchModels,
  loadingModels,
  modelPlaceholder,
  voicePlaceholder,
  getModelOptions,
  isModelDropdownOpen,
  showAllModelOptions,
  onUpdate,
  onProviderChange,
  onToggleApiKey,
  onFetchModels,
  onSelectModel,
  onModelDropdownOpen,
  onModelDropdownToggle,
  onModelTextChange,
  showSpeedControl
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const compact = layout === 'groupCard'
  const fieldWrapStyle = compact ? styles.fieldGroupCard : styles.fieldGroup
  const sectionDividerStyle = [styles.fieldGroupDivider, { borderTopColor: colors.borderSubtle }]

  const Section: React.FC<{ children: React.ReactNode; raised?: boolean }> = ({
    children,
    raised
  }) => {
    if (compact) {
      return (
        <>
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <View style={[styles.fieldGroupCard, raised && styles.fieldGroupRaised]}>{children}</View>
        </>
      )
    }
    return (
      <View style={[sectionDividerStyle, raised && styles.fieldGroupRaised]}>{children}</View>
    )
  }

  const baseUrlPlaceholder =
    config.id === 'clone-tts'
      ? 'http://127.0.0.1:8080'
      : config.id === 'gpt-sovits'
        ? 'http://127.0.0.1:9880'
        : config.id === 'mimo-tts'
          ? t('tts.settings.mimo_base_url_placeholder')
          : 'https://api.openai.com/v1'

  return (
    <>
      <View style={fieldWrapStyle}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.provider_label')}
        </Text>
        {compact ? (
          <View style={styles.chipRow}>
            {providerOptions.map((opt) => {
              const active = config.id === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.primary : colors.borderMuted,
                      backgroundColor: active ? colors.primaryLight : 'transparent'
                    }
                  ]}
                  onPress={() => onProviderChange(opt.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.primary : colors.textSecondary, fontWeight: active ? '600' : '400' }
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : (
          <Select options={providerOptions} value={config.id} onValueChange={onProviderChange} />
        )}
      </View>

      <Section>
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
      </Section>

      {showApiKeyField && (
        <Section>
          <View style={styles.labelRow}>
            <Text style={[styles.label, styles.labelInline, { color: colors.textPrimary }]}>
              {apiKeyOptional
                ? t('tts.settings.api_key_optional_label')
                : t('tts.settings.api_key_label')}
            </Text>
            {apiKeyOptional && <HelpTooltip content={t('tts.settings.api_key_tooltip')} />}
          </View>
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
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.visibilityToggle}
                accessibilityLabel={showApiKey ? t('common.hide') : t('common.show')}
              >
                <MaterialIcons
                  name={showApiKey ? 'visibility-off' : 'visibility'}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            }
          />
        </Section>
      )}

      <Section raised={isModelDropdownOpen}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.model_id_label')}
        </Text>
        <View style={styles.modelRow}>
          <TtsModelCombobox
            value={config.modelId}
            placeholder={modelPlaceholder}
            options={getModelOptions()}
            showAllOptions={showAllModelOptions}
            isOpen={isModelDropdownOpen}
            onChangeText={onModelTextChange}
            onFocus={onModelDropdownOpen}
            onToggleDropdown={onModelDropdownToggle}
            onSelect={onSelectModel}
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
      </Section>

      <Section>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.voice_label')}
        </Text>
        <Input
          style={styles.input}
          value={config.voice}
          onChangeText={(v) => onUpdate({ voice: v })}
          placeholder={voicePlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={[styles.helperText, { color: colors.textTertiary }]}>
          {t('tts.settings.voice_hint')}
        </Text>
      </Section>

      {showSpeedControl && (
        <Section>
          <View style={styles.sliderHeader}>
            <Text style={[styles.label, styles.labelInline, { color: colors.textPrimary }]}>
              {t('tts.settings.speed_label')}
            </Text>
            <Text style={[styles.sliderValue, { color: colors.primary }]}>
              {config.speed.toFixed(1)}x
            </Text>
          </View>
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
        </Section>
      )}

      <Section>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('tts.settings.format_label')}
        </Text>
        <Select
          options={formatOptions}
          value={config.responseFormat}
          onValueChange={(v) => onUpdate({ responseFormat: v })}
          presentation="center"
        />
      </Section>
    </>
  )
}
