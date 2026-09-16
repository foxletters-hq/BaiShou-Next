import { describe, expect, it } from 'vitest'
import { mapLegacyButtonVariant } from '../button.utils'

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
