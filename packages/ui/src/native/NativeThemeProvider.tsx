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

function hexToRgbChannels(hex: string): string | undefined {
  const h = hex.replace('#', '')
  if (h.length !== 6) return undefined
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return undefined
  return `${r}, ${g}, ${b}`
}

function applySeedColor(base: ThemeColors, seed?: string): ThemeColors {
  if (!seed || !/^#[0-9A-Fa-f]{6}$/.test(seed)) return base
  const rgb = hexToRgbChannels(seed)
  return {
    ...base,
    primary: seed,
    primaryDark: seed,
    primaryRgb: rgb ?? base.primaryRgb,
    /** 保持桌面 primaryLight / 轨道色，避免种子色过浅导致整页发飘 */
    primaryLight: base.primaryLight,
    primaryTrackMuted: rgb ? `rgba(${rgb}, 0.24)` : base.primaryTrackMuted
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
