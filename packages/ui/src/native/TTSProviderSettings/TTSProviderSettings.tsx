import React from 'react'
import { ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../SettingsSection'
import { Button } from '../Button'
import { HelpTooltip } from '../Tooltip/HelpTooltip'
import type { TTSProviderSettingsProps } from './tts-provider-settings.types'
import { useTtsProviderSettings } from './useTtsProviderSettings'
import { ttsProviderSettingsStyles as styles } from './tts-provider-settings.styles'
import { TtsBasicFields } from './TtsBasicFields'
import { TtsGptSovitsFields, TtsTestSection } from './TtsGptSovitsFields'

export type { TtsProviderConfig, TTSProviderSettingsProps } from './tts-provider-settings.types'

export const TTSProviderSettings: React.FC<TTSProviderSettingsProps> = (props) => {
  const { t } = useTranslation()
  const vm = useTtsProviderSettings(props)

  return (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
        <TtsBasicFields
          config={vm.config}
          showApiKey={vm.showApiKey}
          speedPercent={vm.speedPercent}
          showApiKeyField={vm.showApiKeyField}
          apiKeyOptional={vm.apiKeyOptional}
          canFetchModels={vm.canFetchModels}
          loadingModels={vm.loadingModels}
          modelOptions={vm.modelOptions}
          onUpdate={vm.update}
          onProviderChange={vm.handleProviderChange}
          onToggleApiKey={() => vm.setShowApiKey(!vm.showApiKey)}
          onFetchModels={vm.handleFetchModels}
          onSelectModel={vm.handleSelectModel}
        />

        {vm.isGptSovits && <TtsGptSovitsFields config={vm.config} onUpdate={vm.update} />}

        <TtsTestSection
          testText={vm.testText}
          testResult={vm.testResult}
          onTestTextChange={vm.setTestText}
        />
      </SettingsSection>

      <View style={styles.actionRow}>
        <Button
          variant="outline"
          onPress={vm.handleTest}
          isLoading={vm.testing}
          isDisabled={!props.onTestTts}
          className="flex-1"
        >
          {t('tts.settings.test_button')}
        </Button>
        <Button
          variant="primary"
          onPress={vm.handleSave}
          isLoading={vm.saving}
          isDisabled={!props.onSaveConfig}
          className="flex-1"
        >
          {t('common.save')}
        </Button>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}
