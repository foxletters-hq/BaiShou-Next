import React, { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { NativeThemeProvider, useNativeTheme, type ThemeModePreference } from '@baishou/ui/native'
import {
  normalizeUiFontSizeLevel,
  uiFontSizeScaleFromLevel,
  UI_FONT_SIZE_LEVEL_DEFAULT
} from '@baishou/shared'
import { subscribeThemeRefresh } from '../lib/theme-events'
import { useBaishou } from './BaishouProvider'

/** 根容器底色与主题同步，fade 转场时避免露出硬编码白底 */
function ThemedRootShell({ children }: { children: React.ReactNode }) {
  const { colors } = useNativeTheme()
  return <View style={{ flex: 1, backgroundColor: colors.bgApp }}>{children}</View>
}

/**
 * 从设置读取 themeMode / seedColor / fontSizeLevel，与桌面 Appearance 设置联动。
 */
export function NativeAppThemeBridge({ children }: { children: React.ReactNode }) {
  const { dbReady, services } = useBaishou()
  const [themeMode, setThemeMode] = useState<ThemeModePreference>('system')
  const [seedColor, setSeedColor] = useState<string | undefined>()
  const [contentFontScale, setContentFontScale] = useState(1)

  const loadThemeFromSettings = useCallback(async () => {
    if (!services) return
    try {
      const settings =
        (await services.settingsManager.get<Record<string, unknown>>('settings')) || {}
      const mode = settings.themeMode as ThemeModePreference | undefined
      if (mode === 'light' || mode === 'dark' || mode === 'system') {
        setThemeMode(mode)
      }
      if (typeof settings.seedColor === 'string' && settings.seedColor) {
        setSeedColor(settings.seedColor)
      }
      const level =
        settings.fontSizeLevel === undefined
          ? UI_FONT_SIZE_LEVEL_DEFAULT
          : normalizeUiFontSizeLevel(settings.fontSizeLevel)
      setContentFontScale(uiFontSizeScaleFromLevel(level))
    } catch {
      // ignore
    }
  }, [services])

  useEffect(() => {
    if (!dbReady || !services) return
    void loadThemeFromSettings()
  }, [dbReady, services, loadThemeFromSettings])

  useEffect(() => {
    if (!dbReady || !services) return
    return subscribeThemeRefresh(() => {
      void loadThemeFromSettings()
    })
  }, [dbReady, services, loadThemeFromSettings])

  return (
    <NativeThemeProvider
      themeMode={themeMode}
      seedColor={seedColor}
      contentFontScale={contentFontScale}
    >
      <ThemedRootShell>{children}</ThemedRootShell>
    </NativeThemeProvider>
  )
}
