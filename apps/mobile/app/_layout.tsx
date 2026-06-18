import 'react-native-gesture-handler'
import '../src/polyfills'
import '../global.css'
import { ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { readOnboardingUiLanguage } from '@/src/lib/onboarding-language.util'
import { getSystemLanguage, resolveAppUiLanguage } from '@/src/lib/device-locale'

import { useNativeTheme, DialogProvider } from '@baishou/ui/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { BaishouProvider, useBaishou } from '@/src/providers/BaishouProvider'
import { IncrementalSyncProvider } from '@/src/providers/IncrementalSyncProvider'
import { useDiaryEmbedFailureToast } from '@/src/hooks/useDiaryEmbedFailureToast'
import { useLegacyUpgradeRagToast } from '@/src/hooks/useLegacyUpgradeRagToast'
import { LegacyMigrationPrompt } from '@/src/components/LegacyMigrationPrompt'
import {
  buildAppNavigationTheme,
  buildThemedFadeStackOptions
} from '@/src/navigation/themedNavigation'
import { NativeAppThemeBridge } from '@/src/providers/NativeAppThemeBridge'
import { HeroUIThemeBridge } from '@/src/providers/HeroUIThemeBridge'

export const unstable_settings = {
  // 深链进入子页面时，栈底保留 tabs 而非引导页
  initialRouteName: '(tabs)'
}

function AppContent() {
  const { isDark, colors } = useNativeTheme()
  const navigationTheme = useMemo(
    () => buildAppNavigationTheme(isDark, colors.bgApp),
    [isDark, colors.bgApp]
  )
  const themedFadeStackOptions = useMemo(
    () => buildThemedFadeStackOptions(colors.bgApp),
    [colors.bgApp]
  )
  const { t } = useTranslation()
  const { dbReady, services } = useBaishou()
  useDiaryEmbedFailureToast()
  useLegacyUpgradeRagToast()

  useEffect(() => {
    if (!dbReady || !services) return
    const loadSavedLanguage = async () => {
      try {
        const settings = (await services.settingsManager.get<any>('settings')) || {}
        const savedLang = settings.language || 'system'
        const onboardingLang = await readOnboardingUiLanguage()
        const targetLang =
          savedLang === 'system'
            ? onboardingLang || getSystemLanguage()
            : resolveAppUiLanguage(savedLang, getSystemLanguage())
        if (i18n.language !== targetLang) {
          await i18n.changeLanguage(targetLang)
        }
      } catch (e) {
        console.error('Failed to load language in root layout', e)
      }
    }
    loadSavedLanguage()
  }, [dbReady, services])

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          ...themedFadeStackOptions
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="onboarding"
          options={{
            gestureEnabled: false,
            fullScreenGestureEnabled: false,
            headerBackVisible: false
          }}
        />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="diary-editor"
          options={{
            presentation: 'modal',
            title: t('diary.editor_title', '编辑记忆'),
            headerShown: false,
            ...themedFadeStackOptions
          }}
        />
        <Stack.Screen name="assistants" />
        <Stack.Screen name="assistant-edit" />
        <Stack.Screen name="lan-transfer" />
        <Stack.Screen name="data-sync" />
        <Stack.Screen name="summary-detail" />
        <Stack.Screen name="storage" />
        <Stack.Screen name="incremental-sync" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BaishouProvider>
          <NativeAppThemeBridge>
            <HeroUIThemeBridge>
              <DialogProvider>
                <IncrementalSyncProvider>
                  <LegacyMigrationPrompt />
                  <AppContent />
                </IncrementalSyncProvider>
              </DialogProvider>
            </HeroUIThemeBridge>
          </NativeAppThemeBridge>
        </BaishouProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
