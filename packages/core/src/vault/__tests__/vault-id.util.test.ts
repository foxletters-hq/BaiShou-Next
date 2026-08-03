import { describe, expect, it } from 'vitest'
import { createRandomVaultId, deriveLegacyVaultId, isVaultId } from '../vault-id.util'

describe('vault-id.util', () => {
  it('deriveLegacyVaultId is deterministic for the same name', () => {
    const a = deriveLegacyVaultId('Personal')
    const b = deriveLegacyVaultId('Personal')
    expect(a).toBe(b)
    expect(a).toMatch(/^vlt_[0-9a-f]{16}$/)
  })

  it('deriveLegacyVaultId differs across names', () => {
    expect(deriveLegacyVaultId('Personal')).not.toBe(deriveLegacyVaultId('Work'))
  })

  it('createRandomVaultId returns vlt_ prefixed hex', () => {
    const id = createRandomVaultId()
    expect(isVaultId(id)).toBe(true)
    expect(id).toMatch(/^vlt_[0-9a-f]{16}$/)
  })

  it('createRandomVaultId is not tied to a fixed name', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createRandomVaultId()))
    expect(ids.size).toBeGreaterThan(1)
  })
})
