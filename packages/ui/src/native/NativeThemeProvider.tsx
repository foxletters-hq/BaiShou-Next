import React, { createContext, useContext, useMemo } from 'react'
import { lightColors, darkColors, sharedTokens } from '../theme'
import { nativeUiFontFamilyName } from '../theme/native-ui-font'

type ThemeColors = typeof lightColors

export type ThemeModePreference = 'system' | 'light' | 'dark'

type NativeThemeContextValue = {
  themeMode: ThemeModePreference
  seedColor?: string
  /** 阅读正文相对默认字号的缩放 */
  contentFontScale: number
  /** 当前语言对应的单个原生字族名 */
  uiFontFamily: string
}

const NativeThemeContext = createContext<NativeThemeContextValue>({
  themeMode: 'system',
  contentFontScale: 1,
  uiFontFamily: nativeUiFontFamilyName('sc')
})

export function NativeThemeProvider({
  themeMode = 'system',
  seedColor,
  contentFontScale = 1,
  uiFontFamily = nativeUiFontFamilyName('sc'),
  children
}: {
  themeMode?: ThemeModePreference
  seedColor?: string
  contentFontScale?: number
  uiFontFamily?: string
  children: React.ReactNode
}) {
  const value = useMemo(
    () => ({ themeMode, seedColor, contentFontScale, uiFontFamily }),
    [themeMode, seedColor, contentFontScale, uiFontFamily]
  )
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
  systemScheme: 'light' | 'dark' | null | undefined,
  uiFontFamily: string = nativeUiFontFamilyName('sc')
) {
  const isDark = mode === 'dark' ? true : mode === 'light' ? false : systemScheme === 'dark'
  const base = isDark ? darkColors : lightColors
  const colors = applySeedColor(base, seedColor)
  return {
    colors,
    tokens: { ...sharedTokens, fontFamily: uiFontFamily },
    isDark
  }
}
