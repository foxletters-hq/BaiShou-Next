import React from 'react'
import { ScrollView, View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../SettingsSection'
import { Button } from '../Button'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import { useNativeTheme } from '../theme'
import type { TTSProviderSettingsProps } from './tts-provider-settings.types'
import { useTtsProviderSettings } from './useTtsProviderSettings'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'
import { TtsBasicFields } from './TtsBasicFields'
import { TtsGptSovitsFields, TtsTestSection } from './TtsGptSovitsFields'

export type { TtsProviderConfig, TTSProviderSettingsProps } from './tts-provider-settings.types'

export const TTSProviderSettings: React.FC<TTSProviderSettingsProps> = (props) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const layout = props.layout ?? 'section'
  const showSaveButton = !props.autoSaveOnFetchModels
  const vm = useTtsProviderSettings(props)

  const fields = (
    <>
      <TtsBasicFields
        layout={layout}
        config={vm.config}
        providerOptions={vm.providerOptions}
        formatOptions={vm.formatOptions}
        showApiKey={vm.showApiKey}
        showApiKeyField={vm.showApiKeyField}
        apiKeyOptional={vm.apiKeyOptional}
        canFetchModels={vm.canFetchModels}
        loadingModels={vm.loadingModels}
        modelPlaceholder={vm.modelPlaceholder}
        voicePlaceholder={vm.voicePlaceholder}
        getModelOptions={vm.getModelOptions}
        isModelDropdownOpen={vm.isModelDropdownOpen}
        showAllModelOptions={vm.showAllModelOptions}
        onUpdate={vm.update}
        onProviderChange={vm.handleProviderChange}
        onToggleApiKey={() => vm.setShowApiKey(!vm.showApiKey)}
        onFetchModels={vm.handleFetchModels}
        onSelectModel={vm.handleSelectModel}
        onModelDropdownOpen={() => {
          vm.setIsModelDropdownOpen(true)
          vm.setShowAllModelOptions(false)
        }}
        onModelDropdownToggle={() => {
          vm.setIsModelDropdownOpen(!vm.isModelDropdownOpen)
          vm.setShowAllModelOptions(true)
        }}
        onModelTextChange={(text) => {
          vm.update({ modelId: text })
          vm.setIsModelDropdownOpen(true)
          vm.setShowAllModelOptions(false)
        }}
        showSpeedControl={vm.showSpeedControl}
      />

      {vm.isGptSovits && (
        <TtsGptSovitsFields
          config={vm.config}
          langOptions={vm.langOptions}
          onUpdate={vm.update}
          compact={layout === 'groupCard'}
        />
      )}

      <TtsTestSection
        compact={layout === 'groupCard'}
        testText={vm.testText}
        testing={vm.testing}
        canTest={!!props.onTestTts}
        onTestTextChange={vm.setTestText}
        onTest={vm.handleTest}
      />
    </>
  )

  const saveButton = (
    <View style={layout === 'groupCard' ? styles.saveActionsGroupCard : styles.saveActions}>
      <Button
        variant="primary"
        onPress={vm.handleSave}
        isLoading={vm.saving}
        isDisabled={!props.onSaveConfig}
        className="min-w-[120px]"
      >
        {t('common.save')}
      </Button>
    </View>
  )

  if (layout === 'groupCard') {
    return (
      <>
        <Text style={[styles.groupCardDesc, { color: colors.textSecondary }]}>
          {t(
            'tts.settings.page_tooltip',
            '配置全局语音合成供应商、模型与发音人。OpenAI 兼容网关可只填 Base URL，无需 API Key 时留空即可获取模型并试听。'
          )}
        </Text>
        {fields}
        {showSaveButton ? saveButton : null}
      </>
    )
  }

  return (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.cardSection}>
        <SettingsSection
          title={t('tts.settings.title')}
          titleAddon={
            <HelpTooltip
              content={t(
                'tts.settings.page_tooltip',
                '配置全局语音合成供应商、模型与发音人。OpenAI 兼容网关可只填 Base URL，无需 API Key 时留空即可获取模型并试听。'
              )}
            />
          }
        >
          {fields}
        </SettingsSection>
      </View>
      {showSaveButton ? saveButton : null}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}
