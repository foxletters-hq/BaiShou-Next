import { describe, it, expect } from 'vitest'
import { formatAppVersion } from '../version.utils'

describe('formatAppVersion', () => {
  it('adds a single v prefix', () => {
    expect(formatAppVersion('4.0.0')).toBe('v4.0.0')
  })

  it('strips duplicate v prefixes', () => {
    expect(formatAppVersion('vv2.0.0-Next-Canary')).toBe('v2.0.0-Next-Canary')
  })
})
