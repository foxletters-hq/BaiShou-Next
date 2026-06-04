import { describe, it, expect } from 'vitest'
import { formatAppVersion } from '../version.utils'

describe('formatAppVersion', () => {
  it('adds a single v prefix for standard versions', () => {
    expect(formatAppVersion('4.0.0')).toBe('v4.0.0')
  })

  it('formats Next line versions without double v', () => {
    expect(formatAppVersion('Next-1.0.0')).toBe('Next 1.0.0')
    expect(formatAppVersion('vvNext-1.0.0')).toBe('Next 1.0.0')
  })

  it('strips duplicate v prefixes for legacy strings', () => {
    expect(formatAppVersion('vv2.0.0-Canary')).toBe('v2.0.0-Canary')
  })
})
