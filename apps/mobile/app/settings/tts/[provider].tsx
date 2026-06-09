import { Redirect, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { isTtsProviderId } from '@baishou/ui/native'
import { StackScreenLayout } from '@/src/components/StackScreenLayout'
import { getStackScreenChrome } from '@/src/components/stackScreenChrome'
import { useNativeTheme } from '@baishou/ui/native'
import { TTSSettingsSection } from '@/src/screens/SettingsScreen/components/TTSSettingsSection'

export default function TtsProviderSettingsRoute() {
  const { provider: providerParam } = useLocalSearchParams<{
    provider: string | string[]
  }>()
  const provider = Array.isArray(providerParam) ? providerParam[0] : providerParam
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)

  if (!provider || !isTtsProviderId(provider)) {
    return <Redirect href="/settings/tts" />
  }

  return (
    <StackScreenLayout
      title={t('settings.tts_settings')}
      {...chrome}
      contentStyle={{ flex: 1, padding: 16, paddingBottom: 32 }}
    >
      <TTSSettingsSection providerId={provider} />
    </StackScreenLayout>
  )
}
