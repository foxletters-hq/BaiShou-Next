import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import {
  getGlobalFontScale,
  setGlobalFontScale,
  scaleFontStyle,
  installNativeFontScaling
} from '../native-font-scale'

describe('native-font-scale', () => {
  beforeEach(() => {
    setGlobalFontScale(1)
  })

  it('updates and gets global font scale', () => {
    expect(getGlobalFontScale()).toBe(1)
    setGlobalFontScale(1.33)
    expect(getGlobalFontScale()).toBe(1.33)
    setGlobalFontScale(0) // invalid, ignore
    expect(getGlobalFontScale()).toBe(1.33)
    setGlobalFontScale(-1) // invalid, ignore
    expect(getGlobalFontScale()).toBe(1.33)
  })

  it('scales font style when scale is not 1', () => {
    const originalStyle = { fontSize: 16, lineHeight: 24, color: '#333' }
    const scaled = scaleFontStyle(originalStyle, 1.5)
    expect(scaled).toEqual([originalStyle, { fontSize: 24, lineHeight: 36 }])

    // when scale is 1, return original directly
    expect(scaleFontStyle(originalStyle, 1)).toBe(originalStyle)
  })

  it('preserves array styles when scaling', () => {
    const styleArr = [{ color: 'red' }, { fontSize: 14 }]
    const scaled = scaleFontStyle(styleArr, 1.2)
    expect(scaled).toEqual([{ color: 'red' }, { fontSize: 14 }, { fontSize: 17 }])
  })

  it('handles styles without fontSize safely', () => {
    const noFont = { color: 'blue', padding: 8 }
    expect(scaleFontStyle(noFont, 1.5)).toBe(noFont)
  })

  it('installs patching on target react-native object', () => {
    const mockOriginalText = (props: any) => React.createElement('MockText', props)
    const mockOriginalTextInput = (props: any) => React.createElement('MockTextInput', props)
    const mockRN: any = {
      StyleSheet: {
        flatten: (s: any) => (Array.isArray(s) ? Object.assign({}, ...s) : s)
      },
      Text: mockOriginalText,
      TextInput: mockOriginalTextInput
    }

    const success = installNativeFontScaling(mockRN)
    expect(success).toBe(true)
    expect(mockRN.Text).not.toBe(mockOriginalText)
    expect(mockRN.TextInput).not.toBe(mockOriginalTextInput)

    setGlobalFontScale(1.5)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rendered = (mockRN.Text as any).render(
      { style: { fontSize: 16, lineHeight: 20 }, children: 'hello' },
      null
    )
    consoleSpy.mockRestore()
    expect(rendered.props.style).toEqual([
      { fontSize: 16, lineHeight: 20 },
      { fontSize: 24, lineHeight: 30 }
    ])

    // disableGlobalFontScale opt-out
    const consoleSpy2 = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unscaled = (mockRN.Text as any).render(
      { style: { fontSize: 16 }, disableGlobalFontScale: true, children: 'fixed' },
      null
    )
    consoleSpy2.mockRestore()
    expect(unscaled.props.style).toEqual({ fontSize: 16 })
  })
})
