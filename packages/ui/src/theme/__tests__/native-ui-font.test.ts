import { describe, expect, it } from 'vitest'
import { buildNativeThemePalette } from '../../native/NativeThemeProvider'

describe('native ui theme tokens', () => {
  it('should omit fontFamily so Text uses the system typeface', () => {
    const { tokens } = buildNativeThemePalette('light', undefined, 'light')
    expect(tokens.fontFamily).toBeUndefined()
  })
})
