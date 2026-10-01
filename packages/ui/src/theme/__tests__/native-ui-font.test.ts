import { describe, expect, it } from 'vitest'
import { buildNativeThemePalette } from '../../native/NativeThemeProvider'
import {
  nativeUiFontFamilyFromLanguage,
  nativeUiFontFamilyName,
  resolveNativeUiFontRole
} from '../native-ui-font'

describe('native ui font family token', () => {
  it('should pick the source-han family from the ui language', () => {
    expect(resolveNativeUiFontRole('zh')).toBe('sc')
    expect(resolveNativeUiFontRole('zh-CN')).toBe('sc')
    expect(resolveNativeUiFontRole('zh-TW')).toBe('tc')
    expect(resolveNativeUiFontRole('zh_TW')).toBe('tc')
    expect(resolveNativeUiFontRole('ja')).toBe('jp')
    expect(resolveNativeUiFontRole('en')).toBe('latin')
    expect(resolveNativeUiFontRole(undefined)).toBe('sc')
  })

  it('should expose a single native family name per role', () => {
    expect(nativeUiFontFamilyName('sc')).toBe('Noto Sans SC')
    expect(nativeUiFontFamilyName('tc')).toBe('Noto Sans TC')
    expect(nativeUiFontFamilyName('jp')).toBe('Noto Sans JP')
    expect(nativeUiFontFamilyName('latin')).toBe('Noto Sans')
    expect(nativeUiFontFamilyFromLanguage('zh-TW')).toBe('Noto Sans TC')
  })

  it('should write the native family onto theme tokens', () => {
    const { tokens } = buildNativeThemePalette('light', undefined, 'light', 'Noto Sans TC')
    expect(tokens.fontFamily).toBe('Noto Sans TC')
  })
})
