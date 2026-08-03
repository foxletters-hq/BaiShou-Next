import { describe, it, expect } from 'vitest'
import { pickActiveVault, pickActiveVaultNameFromRegistryEntries } from '../active-vault.util'

describe('pickActiveVault', () => {
  const vaults = [
    { id: 'vlt_aaa', name: 'A', lastAccessedAt: new Date('2024-01-01T00:00:00.000Z') },
    { id: 'vlt_bbb', name: 'B', lastAccessedAt: new Date('2025-01-01T00:00:00.000Z') }
  ]

  it('prefers local activeVaultId over newer lastAccessedAt', () => {
    expect(pickActiveVault(vaults, 'vlt_aaa')?.name).toBe('A')
  })

  it('falls back to lastAccessedAt when preferred id is missing', () => {
    expect(pickActiveVault(vaults, 'vlt_missing')?.name).toBe('B')
    expect(pickActiveVault(vaults, null)?.name).toBe('B')
    expect(pickActiveVault(vaults, '')?.name).toBe('B')
  })

  it('returns null for empty list', () => {
    expect(pickActiveVault([], 'vlt_aaa')).toBeNull()
  })
})

describe('pickActiveVaultNameFromRegistryEntries', () => {
  const entries = [
    { id: 'vlt_aaa', name: 'A', lastAccessedAt: '2024-01-01T00:00:00.000Z' },
    { id: 'vlt_bbb', name: 'B', lastAccessedAt: '2025-01-01T00:00:00.000Z' }
  ]

  it('resolves name by preferred id', () => {
    expect(pickActiveVaultNameFromRegistryEntries(entries, 'vlt_aaa')).toBe('A')
  })

  it('falls back to lastAccessedAt when id missing', () => {
    expect(pickActiveVaultNameFromRegistryEntries(entries, 'vlt_gone')).toBe('B')
  })
})
