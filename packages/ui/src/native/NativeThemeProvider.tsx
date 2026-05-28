import React, { createContext, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { lightColors, darkColors, sharedTokens } from '../theme'

type ThemeColors = typeof lightColors

export type ThemeModePreference = 'system' | 'light' | 'dark'

type NativeThemeContextValue = {
  themeMode: ThemeModePreference
  seedColor?: string
}

const NativeThemeContext = createContext<NativeThemeContextValue>({
  themeMode: 'system'
})

export function NativeThemeProvider({
  themeMode = 'system',
  seedColor,
  children
}: {
  themeMode?: ThemeModePreference
  seedColor?: string
  children: React.ReactNode
}) {
  const value = useMemo(() => ({ themeMode, seedColor }), [themeMode, seedColor])
  return <NativeThemeContext.Provider value={value}>{children}</NativeThemeContext.Provider>
}

function applySeedColor(base: ThemeColors, seed?: string): ThemeColors {
  if (!seed || !/^#[0-9A-Fa-f]{6}$/.test(seed)) return base
  return {
    ...base,
    primary: seed,
    primaryDark: seed,
    primaryLight: seed + '22'
  }
}

export function useNativeThemeContext() {
  return useContext(NativeThemeContext)
}

/** 解析 effective 深色模式与色板（纯函数，供 useNativeTheme 调用） */
export function buildNativeThemePalette(
  mode: ThemeModePreference,
  seedColor: string | undefined,
  systemScheme: 'light' | 'dark' | null | undefined
) {
  const isDark = mode === 'dark' ? true : mode === 'light' ? false : systemScheme === 'dark'
  const base = isDark ? darkColors : lightColors
  const colors = applySeedColor(base, seedColor)
  return { colors, tokens: sharedTokens, isDark }
}
