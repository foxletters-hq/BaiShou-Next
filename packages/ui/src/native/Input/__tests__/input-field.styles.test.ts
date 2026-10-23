import { describe, expect, it } from 'vitest'
import { lightColors } from '../../../theme/light'
import { mobileControlTokens } from '../../../theme/tokens'
import { getHeroInputFieldStyle } from '../input-field.styles'

describe('native Input field styles', () => {
  it('should stretch the default field to full width', () => {
    const style = getHeroInputFieldStyle(lightColors)
    expect(style.width).toBe('100%')
    expect(style.minHeight).toBe(mobileControlTokens.height)
  })

  it('should omit full width on compact fields', () => {
    const compact = getHeroInputFieldStyle(lightColors, { compact: true })
    expect(compact.width).toBeUndefined()
    expect(compact.minHeight).toBeUndefined()
  })
})
