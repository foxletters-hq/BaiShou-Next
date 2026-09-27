import { describe, expect, it } from 'vitest'
import { lightColors } from '../../../theme/light'
import { getHeroButtonLabelStyle, getHeroButtonRootStyle } from '../button-field.styles'
import { mapLegacyButtonVariant, resolveNativeButtonVariant } from '../button.utils'

describe('mapLegacyButtonVariant', () => {
  it('maps every legacy variant to outline so native buttons stay bordered', () => {
    expect(mapLegacyButtonVariant('elevated', false)).toEqual({ variant: 'outline' })
    expect(mapLegacyButtonVariant('outlined', false)).toEqual({ variant: 'outline' })
    expect(mapLegacyButtonVariant('text', false)).toEqual({ variant: 'outline' })
  })

  it('keeps destructive actions outlined instead of filled', () => {
    expect(mapLegacyButtonVariant('text', true)).toEqual({
      variant: 'outline',
      labelClassName: 'text-danger'
    })
  })
})

describe('resolveNativeButtonVariant', () => {
  it('should render primary as an outline when it is the main action', () => {
    expect(resolveNativeButtonVariant('primary', false)).toEqual({ variant: 'outline' })
    const root = getHeroButtonRootStyle(lightColors, 'outline')
    expect(root.backgroundColor).toBe(lightColors.bgSurface)
    expect(root.borderColor).toBe(lightColors.borderControl)
    expect(getHeroButtonLabelStyle(lightColors, 'outline').color).toBe(lightColors.textPrimary)
  })
})
