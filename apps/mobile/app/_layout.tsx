import 'react-native-gesture-handler'
import '../src/polyfills'
import '../global.css'
import { ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import 'react-native-reanimated'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { readOnboardingUiLanguage } from '@/src/lib/onboarding-language.util'
import { getSystemLanguage, resolveAppUiLanguage } from '@/src/lib/device-locale'

import {
  useNativeTheme,
  DialogProvider,
  ToastProvider,
  RestoreBlockingOverlay
} from '@baishou/ui/native'
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context'
import { BaishouProvider, useBaishou } from '@/src/providers/BaishouProvider'
import { NetworkProvider, NetworkOfflineBanner } from '@/src/providers/NetworkProvider'
import { IncrementalSyncProvider } from '@/src/providers/IncrementalSyncProvider'
import { useDiaryEmbedFailureToast } from '@/src/hooks/useDiaryEmbedFailureToast'
import { useLegacyUpgradeRagToast } from '@/src/hooks/useLegacyUpgradeRagToast'
import { LegacyMigrationPrompt } from '@/src/components/LegacyMigrationPrompt'
import {
  buildAppNavigationTheme,
  buildThemedFadeStackOptions,
  buildThemedSlideStackOptions
} from '@/src/navigation/themedNavigation'
import { useDevLanTransferDeepLinkReplayGuard } from '@/src/navigation/useDevLanTransferDeepLinkReplayGuard'
import { NativeAppThemeBridge } from '@/src/providers/NativeAppThemeBridge'
import { HeroUIThemeBridge } from '@/src/providers/HeroUIThemeBridge'
import '@/src/screens/DiaryScreen/diary-filter-state.util'
import { installMobileDiagnosticLog } from '@/src/services/install-mobile-diagnostic-log'
import {
  ensureMobileAgentGateNotifications,
  setMobileAgentGateNotificationNavigateHandler
} from '@/src/services/mobile-agent-gate-notifications'
import { preloadDiaryEditorWebViewSource } from '@/src/hooks/useDiaryEditorWebViewSource'
import { router } from 'expo-router'

export const unstable_settings = {
  // 深链进入子页面时，栈底保留 tabs 而非引导页
  initialRouteName: '(tabs)'
}

void SplashScreen.preventAutoHideAsync()

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
  const themedSlideStackOptions = useMemo(
    () => buildThemedSlideStackOptions(colors.bgApp),
    [colors.bgApp]
  )
  const { t } = useTranslation()
  const { dbReady, services, switchingVaultName } = useBaishou()
  useDiaryEmbedFailureToast()
  useLegacyUpgradeRagToast()
  useDevLanTransferDeepLinkReplayGuard()

  useEffect(() => {
    void preloadDiaryEditorWebViewSource()
  }, [])

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

  useEffect(() => {
    setMobileAgentGateNotificationNavigateHandler((sessionId, requestId) => {
      router.push({
        pathname: '/(tabs)/agent',
        params: { sessionId, gateRequestId: requestId }
      })
    })
    let dispose: (() => void) | undefined
    void ensureMobileAgentGateNotifications().then((unsub) => {
      dispose = unsub
    })
    return () => {
      dispose?.()
      setMobileAgentGateNotificationNavigateHandler(null)
    }
  }, [])

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          ...themedSlideStackOptions
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            ...themedFadeStackOptions
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            gestureEnabled: false,
            fullScreenGestureEnabled: false,
            headerBackVisible: false,
            ...themedFadeStackOptions
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            ...themedFadeStackOptions
          }}
        />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="diary-editor"
          options={{
            presentation: 'fullScreenModal',
            title: t('diary.editor_title', '编辑记忆'),
            headerShown: false,
            ...themedFadeStackOptions
          }}
        />
        <Stack.Screen name="assistants" />
        <Stack.Screen name="assistant-edit" />
        <Stack.Screen name="data-sync" />
        <Stack.Screen name="summary-detail" />
        <Stack.Screen name="storage" />
        <Stack.Screen name="incremental-sync" />
        <Stack.Screen name="graph" />
        <Stack.Screen name="graph-view" />
        <Stack.Screen name="graph-node" />
        <Stack.Screen name="graph-review" />
        <Stack.Screen name="memory" />
      </Stack>
      <RestoreBlockingOverlay
        visible={Boolean(switchingVaultName)}
        message={t('workspace.switching_overlay', '正在切换小窝…')}
        hint={
          switchingVaultName
            ? t('workspace.switching_overlay_hint', '正在加载「{{name}}」的数据，请勿操作', {
                name: switchingVaultName
              })
            : undefined
        }
      />
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}

export default function RootLayout() {
  useEffect(() => {
    installMobileDiagnosticLog()
  }, [])

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined)
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <BaishouProvider>
          <NetworkProvider>
            <NativeAppThemeBridge>
              <HeroUIThemeBridge>
                <DialogProvider>
                  <ToastProvider>
                    <IncrementalSyncProvider>
                      <LegacyMigrationPrompt />
                      <AppContent />
                      <NetworkOfflineBanner />
                    </IncrementalSyncProvider>
                  </ToastProvider>
                </DialogProvider>
              </HeroUIThemeBridge>
            </NativeAppThemeBridge>
          </NetworkProvider>
        </BaishouProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
