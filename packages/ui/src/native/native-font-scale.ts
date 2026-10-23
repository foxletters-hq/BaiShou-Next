import React from 'react'
// eslint-disable-next-line no-restricted-imports
import * as ReactNative from 'react-native'

let currentGlobalFontScale = 1
const fontScaleListeners = new Set<() => void>()
let isInstalled = false

export function isNativeFontScalingInstalled(): boolean {
  return isInstalled
}

declare module 'react-native' {
  interface TextProps {
    disableGlobalFontScale?: boolean
  }
  interface TextInputProps {
    disableGlobalFontScale?: boolean
  }
}

export function getGlobalFontScale(): number {
  return currentGlobalFontScale
}

export function setGlobalFontScale(scale: number): void {
  if (
    typeof scale === 'number' &&
    Number.isFinite(scale) &&
    scale > 0 &&
    currentGlobalFontScale !== scale
  ) {
    currentGlobalFontScale = scale
    fontScaleListeners.forEach((listener) => {
      try {
        listener()
      } catch (err) {
        console.warn('[FontScale] listener error', err)
      }
    })
  }
}

export function subscribeGlobalFontScale(listener: () => void): () => void {
  fontScaleListeners.add(listener)
  return () => {
    fontScaleListeners.delete(listener)
  }
}

/**
 * 响应式全局字体缩放 Hook（基于 React 18/19 useSyncExternalStore）
 */
export function useGlobalFontScale(): number {
  try {
    return React.useSyncExternalStore(
      subscribeGlobalFontScale,
      getGlobalFontScale,
      getGlobalFontScale
    )
  } catch {
    return getGlobalFontScale()
  }
}

export interface ScaledTextProps extends ReactNative.TextProps {
  disableGlobalFontScale?: boolean
}

export interface ScaledTextInputProps extends ReactNative.TextInputProps {
  disableGlobalFontScale?: boolean
}

/**
 * 展平样式（兼容空值、对象、嵌套数组）
 */
export function flattenStyle(style: unknown): Record<string, any> | null {
  if (!style) return null
  if (Array.isArray(style)) {
    const result: Record<string, any> = {}
    for (const item of style) {
      if (item) {
        const flatItem = flattenStyle(item)
        if (flatItem) {
          Object.assign(result, flatItem)
        }
      }
    }
    return result
  }
  if (typeof style === 'object') {
    return style as Record<string, any>
  }
  return null
}

function extractFontMetrics(style: unknown): { fontSize?: number; lineHeight?: number } | null {
  if (!style) return null
  if (!Array.isArray(style)) {
    return typeof style === 'object' ? (style as { fontSize?: number; lineHeight?: number }) : null
  }
  let fontSize: number | undefined
  let lineHeight: number | undefined
  for (let i = style.length - 1; i >= 0; i--) {
    const item = style[i]
    if (!item) continue
    const metrics = Array.isArray(item)
      ? extractFontMetrics(item)
      : typeof item === 'object'
        ? (item as { fontSize?: number; lineHeight?: number })
        : null
    if (!metrics) continue
    if (fontSize === undefined && metrics.fontSize !== undefined) {
      fontSize = metrics.fontSize
    }
    if (lineHeight === undefined && metrics.lineHeight !== undefined) {
      lineHeight = metrics.lineHeight
    }
    if (fontSize !== undefined && lineHeight !== undefined) break
  }
  return { fontSize, lineHeight }
}

/**
 * 根据缩放倍率计算样式中的 fontSize 与 lineHeight
 */
export function scaleFontStyle<T>(style: T, scale: number, fallbackFontSize?: number): T {
  if (scale === 1 || !Number.isFinite(scale) || scale <= 0) {
    return style
  }
  const flat = extractFontMetrics(style)
  const baseFontSize =
    flat && typeof flat.fontSize === 'number' && flat.fontSize > 0
      ? flat.fontSize
      : fallbackFontSize

  if (typeof baseFontSize !== 'number' || baseFontSize <= 0) {
    return style
  }

  const scaledFontSize = Math.round(baseFontSize * scale)
  const override: { fontSize: number; lineHeight?: number } = {
    fontSize: scaledFontSize
  }
  if (flat && typeof flat.lineHeight === 'number' && flat.lineHeight > 0) {
    override.lineHeight = Math.round(flat.lineHeight * scale)
  }

  return (Array.isArray(style) ? [...style, override] : [style, override]) as unknown as T
}

export function installNativeFontScaling(targetRN?: any): boolean {
  // 获取真实的 react-native 模块导出对象
  let rawRN: any = targetRN || null
  if (!rawRN) {
    try {
      if (typeof require === 'function') {
        rawRN = require('react-native')
      }
    } catch {}
  }
  if (!rawRN) {
    rawRN = ReactNative as any
  }
  if (!rawRN) return false

  const g = globalThis as any
  if (g.__baishouFontScalingInstalled && rawRN.__baishouFontScalingInstalled) {
    return true
  }

  // 获取真正的原始 Text 与 TextInput
  let OriginalText: any = null
  let OriginalTextInput: any = null
  let textModule: any = null
  let textInputModule: any = null

  try {
    if (typeof require === 'function') {
      textModule = require('react-native/Libraries/Text/Text')
      if (textModule && textModule.default) {
        OriginalText = textModule.default
      }
    }
  } catch {}

  try {
    if (typeof require === 'function') {
      textInputModule = require('react-native/Libraries/Components/TextInput/TextInput')
      if (textInputModule && textInputModule.default) {
        OriginalTextInput = textInputModule.default
      }
    }
  } catch {}

  if (!OriginalText) {
    OriginalText = rawRN.Text
  }
  if (!OriginalTextInput) {
    OriginalTextInput = rawRN.TextInput
  }
  if (!OriginalText) return false

  // 尝试获取 TextAncestorContext
  const FallbackAncestorContext = React.createContext(false)
  let TextAncestorContext: React.Context<boolean> = FallbackAncestorContext
  try {
    if (typeof require === 'function') {
      const resolved = require('react-native/Libraries/Text/TextAncestorContext')?.default
      if (resolved) {
        TextAncestorContext = resolved
      }
    }
    if (TextAncestorContext === FallbackAncestorContext && rawRN.unstable_TextAncestorContext) {
      TextAncestorContext = rawRN.unstable_TextAncestorContext
    }
  } catch {}

  function useHasTextAncestor(): boolean {
    try {
      return React.useContext(TextAncestorContext)
    } catch {
      return false
    }
  }

  function useScaledFontStyle<T>(
    style: T,
    scale: number,
    fallbackFontSize?: number,
    disabled?: boolean
  ): T {
    try {
      return React.useMemo(
        () =>
          disabled || scale === 1 || !scale
            ? style
            : scaleFontStyle(style, scale, fallbackFontSize),
        [style, scale, fallbackFontSize, disabled]
      )
    } catch {
      return disabled || scale === 1 || !scale
        ? style
        : scaleFontStyle(style, scale, fallbackFontSize)
    }
  }

  const PatchedText = React.forwardRef<any, ScaledTextProps>((props, ref) => {
    const scale = useGlobalFontScale()
    const hasAncestor = useHasTextAncestor()
    const { style, disableGlobalFontScale, ...rest } = props
    // 若为顶层独立文本且没有指定 fontSize，React Native 默认字号为 14
    const fallbackFontSize = !hasAncestor ? 14 : undefined
    const scaledStyle = useScaledFontStyle(style, scale, fallbackFontSize, disableGlobalFontScale)
    return React.createElement(OriginalText, { ...rest, style: scaledStyle, ref })
  })
  PatchedText.displayName = 'Text'
  if (OriginalText) {
    Object.setPrototypeOf(PatchedText, OriginalText)
  }

  let PatchedTextInput: any = null
  if (OriginalTextInput) {
    PatchedTextInput = React.forwardRef<any, ScaledTextInputProps>((props, ref) => {
      const scale = useGlobalFontScale()
      const { style, disableGlobalFontScale, ...rest } = props
      const scaledStyle = useScaledFontStyle(style, scale, undefined, disableGlobalFontScale)
      return React.createElement(OriginalTextInput, { ...rest, style: scaledStyle, ref })
    })
    PatchedTextInput.displayName = 'TextInput'
    Object.setPrototypeOf(PatchedTextInput, OriginalTextInput)
  }

  // 1. 拦截 Libraries/Text/Text
  if (textModule) {
    try {
      textModule.default = PatchedText
    } catch {}
  }

  // 2. 拦截 Libraries/Components/TextInput/TextInput
  if (textInputModule && PatchedTextInput) {
    try {
      textInputModule.default = PatchedTextInput
    } catch {}
  }

  // 3. 拦截 rawRN.Text / rawRN.TextInput
  try {
    Object.defineProperty(rawRN, 'Text', {
      configurable: true,
      enumerable: true,
      get: () => PatchedText
    })
    if (PatchedTextInput) {
      Object.defineProperty(rawRN, 'TextInput', {
        configurable: true,
        enumerable: true,
        get: () => PatchedTextInput
      })
    }
  } catch (err) {
    console.warn('[FontScaling] Failed to patch rawRN', err)
  }

  // 4. 拦截 wildcard 对象（如果在 ESM 导入环境中不同）
  if (ReactNative && ReactNative !== rawRN) {
    try {
      Object.defineProperty(ReactNative, 'Text', {
        configurable: true,
        enumerable: true,
        get: () => PatchedText
      })
      if (PatchedTextInput) {
        Object.defineProperty(ReactNative, 'TextInput', {
          configurable: true,
          enumerable: true,
          get: () => PatchedTextInput
        })
      }
    } catch {}
  }

  rawRN.__baishouFontScalingInstalled = true
  g.__baishouFontScalingInstalled = true
  isInstalled = true
  return true
}
