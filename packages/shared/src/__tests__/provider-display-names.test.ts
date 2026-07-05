import { describe, expect, it } from 'vitest'
import { resolveProviderDisplayName } from '../constants/provider-display-names'

describe('resolveProviderDisplayName', () => {
  it('formats opencodego with a space', () => {
    expect(resolveProviderDisplayName('opencodego')).toBe('OpenCode Go')
  })

  it('capitalizes unknown provider ids', () => {
    expect(resolveProviderDisplayName('deepseek')).toBe('Deepseek')
  })
})
