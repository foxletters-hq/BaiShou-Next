import React, { useCallback, useEffect, useState } from 'react'
import { NativeThemeProvider, type ThemeModePreference } from '@baishou/ui/native'
import { subscribeThemeRefresh } from '../lib/theme-events'
import { useBaishou } from './BaishouProvider'

/**
 * 从设置读取 themeMode / seedColor，与桌面 Appearance 设置联动。
 */
export function NativeAppThemeBridge({ children }: { children: React.ReactNode }) {
  const { dbReady, services } = useBaishou()
  const [themeMode, setThemeMode] = useState<ThemeModePreference>('system')
  const [seedColor, setSeedColor] = useState<string | undefined>()

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
    <NativeThemeProvider themeMode={themeMode} seedColor={seedColor}>
      {children}
    </NativeThemeProvider>
  )
}
