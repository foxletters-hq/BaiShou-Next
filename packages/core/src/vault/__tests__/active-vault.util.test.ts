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

  it('prefers Personal base vault over newer derivative vault when no preference', () => {
    const list = [
      { id: 'vlt_deriv', name: 'Personal45', lastAccessedAt: new Date('2026-11-04T00:00:00.000Z') },
      { id: 'vlt_base', name: 'Personal', lastAccessedAt: new Date('2026-10-01T00:00:00.000Z') }
    ]
    expect(pickActiveVault(list, null)?.name).toBe('Personal')
    expect(pickActiveVault(list, undefined)?.id).toBe('vlt_base')
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

  it('prefers base Personal over newer derivative vault without preference', () => {
    const mixed = [
      { id: 'vlt_deriv', name: 'Personal82', lastAccessedAt: '2026-11-04T00:00:00.000Z' },
      { id: 'vlt_base', name: 'Personal', lastAccessedAt: '2026-10-01T00:00:00.000Z' }
    ]
    expect(pickActiveVaultNameFromRegistryEntries(mixed, null)).toBe('Personal')
  })
})
