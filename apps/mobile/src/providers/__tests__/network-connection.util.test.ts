import { describe, expect, it } from 'vitest'
import { resolveConnectionType, resolveIsMetered } from '../network-connection.util'

describe('network-connection.util', () => {
  it('maps NetInfo types to connectionType', () => {
    expect(resolveConnectionType({ type: 'wifi' } as never)).toBe('wifi')
    expect(resolveConnectionType({ type: 'cellular' } as never)).toBe('cellular')
    expect(resolveConnectionType({ type: 'ethernet' } as never)).toBe('other')
    expect(resolveConnectionType({ type: 'unknown' } as never)).toBe('unknown')
    expect(resolveConnectionType(null)).toBe('unknown')
  })

  it('marks cellular and expensive connections as metered', () => {
    expect(resolveIsMetered({ type: 'cellular' } as never, 'cellular')).toBe(true)
    expect(resolveIsMetered({ type: 'wifi', details: {} } as never, 'wifi')).toBe(false)
    expect(
      resolveIsMetered(
        { type: 'wifi', details: { isConnectionExpensive: true } } as never,
        'wifi'
      )
    ).toBe(true)
    expect(resolveIsMetered({ type: 'unknown' } as never, 'unknown')).toBe(false)
  })
})
