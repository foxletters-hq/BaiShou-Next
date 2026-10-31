import { describe, expect, it } from 'vitest'
import { lightColors } from '../../../theme/light'
import { mobileControlTokens, sharedTokens } from '../../../theme/tokens'
import { getHeroInputFieldStyle } from '../input-field.styles'

describe('native Input field styles', () => {
  it('should stretch the default field to full width and clamp single-line height', () => {
    const style = getHeroInputFieldStyle(lightColors)
    expect(style.width).toBe('100%')
    expect(style.minHeight).toBe(mobileControlTokens.height)
    expect(style.maxHeight).toBe(mobileControlTokens.height)
  })

  it('should omit full width on compact fields', () => {
    const compact = getHeroInputFieldStyle(lightColors, { compact: true })
    expect(compact.width).toBeUndefined()
    expect(compact.minHeight).toBeUndefined()
    expect(compact.maxHeight).toBeUndefined()
  })

  it('should not clamp maxHeight on multiline fields and should apply vertical padding', () => {
    const multiline = getHeroInputFieldStyle(lightColors, { multiline: true })
    expect(multiline.minHeight).toBeUndefined()
    expect(multiline.maxHeight).toBeUndefined()
    expect(multiline.paddingVertical).toBe(sharedTokens.spacing.smPlus)
  })
})
