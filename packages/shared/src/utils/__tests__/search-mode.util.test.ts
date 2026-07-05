import { describe, expect, it } from 'vitest'
import { resolveWebSearchEnabled } from '../search-mode.util'

describe('resolveWebSearchEnabled', () => {
  it('respects explicit true/false', () => {
    expect(resolveWebSearchEnabled(true, false)).toBe(true)
    expect(resolveWebSearchEnabled(false, true)).toBe(false)
  })

  it('defaults to enabled when preference is unset', () => {
    expect(resolveWebSearchEnabled(undefined, undefined)).toBe(true)
    expect(resolveWebSearchEnabled(undefined, null)).toBe(true)
  })

  it('uses stored preference when explicit is unset', () => {
    expect(resolveWebSearchEnabled(undefined, true)).toBe(true)
    expect(resolveWebSearchEnabled(undefined, false)).toBe(false)
  })
})
