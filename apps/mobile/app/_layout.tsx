import 'react-native-gesture-handler'
import '../src/polyfills'
import '../global.css'
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import 'react-native-reanimated'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, NativeModules } from 'react-native'
import i18n from 'i18next'

import { useNativeTheme, DialogProvider } from '@baishou/ui/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { BaishouProvider, useBaishou } from '@/src/providers/BaishouProvider'
import { NativeAppThemeBridge } from '@/src/providers/NativeAppThemeBridge'
import { HeroUIThemeBridge } from '@/src/providers/HeroUIThemeBridge'

SplashScreen.preventAutoHideAsync()

export const unstable_settings = {
  // 深链进入子页面时，栈底保留 tabs 而非引导页
  initialRouteName: '(tabs)'
}

const getSystemLanguage = () => {
  try {
    let locale = 'zh'
    if (Platform.OS === 'ios') {
      locale =
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        'zh'
    } else if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier || 'zh'
    }
    const cleanLang = locale.split(/[-_]/)[0]
    return ['zh', 'en', 'ja', 'zh-TW'].includes(cleanLang) ? cleanLang : 'zh'
  } catch (e) {
    return 'zh'
  }
}

function AppContent() {
  const { isDark } = useNativeTheme()
  const { t } = useTranslation()
  const { dbReady, services } = useBaishou()

  useEffect(() => {
    if (!dbReady || !services) return
    const loadSavedLanguage = async () => {
      try {
        const settings = (await services.settingsManager.get<any>('settings')) || {}
        const savedLang = settings.language || 'system'
        const targetLang = savedLang === 'system' ? getSystemLanguage() : savedLang
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
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="diary-editor"
          options={{
            presentation: 'modal',
            title: t('diary.editor_title', '编辑记忆'),
            headerShown: false
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
  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BaishouProvider>
          <NativeAppThemeBridge>
            <HeroUIThemeBridge>
              <DialogProvider>
                <AppContent />
              </DialogProvider>
            </HeroUIThemeBridge>
          </NativeAppThemeBridge>
        </BaishouProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
