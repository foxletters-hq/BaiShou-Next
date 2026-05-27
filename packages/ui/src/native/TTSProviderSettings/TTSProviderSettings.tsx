import React from 'react'
import { ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../SettingsSection'
import { Button } from '../Button'
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
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <SettingsSection title={t('tts.title', 'TTS 语音合成设置')}>
        <TtsBasicFields
          config={vm.config}
          showApiKey={vm.showApiKey}
          speedPercent={vm.speedPercent}
          onUpdate={vm.update}
          onProviderChange={vm.handleProviderChange}
          onToggleApiKey={() => vm.setShowApiKey(!vm.showApiKey)}
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
          variant="outlined"
          onPress={vm.handleTest}
          isLoading={vm.testing}
          disabled={!props.onTestTts}
          style={styles.actionBtn}
        >
          {t('tts.test', '测试 TTS')}
        </Button>
        <Button
          onPress={vm.handleSave}
          isLoading={vm.saving}
          disabled={!props.onSaveConfig}
          style={styles.actionBtn}
        >
          {t('common.save', '保存')}
        </Button>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}
