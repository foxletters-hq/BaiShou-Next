import { describe, expect, it } from 'vitest'
import { createRandomVaultId, deriveLegacyVaultId } from '../vault-id.util'
import { resolveVaultIdFromRecord } from '../vault-record-id.util'

describe('resolveVaultIdFromRecord', () => {
  it('prefers explicit stable vaultId over vaultName', () => {
    const stableId = createRandomVaultId()
    expect(
      resolveVaultIdFromRecord({
        vaultId: stableId,
        vaultName: 'Personal'
      })
    ).toBe(stableId)
  })

  it('uses inferredVaultName before vaultName snapshot', () => {
    const fromInferred = deriveLegacyVaultId('Work')
    expect(
      resolveVaultIdFromRecord({
        vaultName: 'Personal',
        inferredVaultName: 'Work'
      })
    ).toBe(fromInferred)
  })

  it('derives from vaultName when no id or inferred name', () => {
    expect(
      resolveVaultIdFromRecord({
        vaultName: 'Personal'
      })
    ).toBe(deriveLegacyVaultId('Personal'))
  })

  it('falls back to Personal when all inputs empty', () => {
    expect(resolveVaultIdFromRecord({})).toBe(deriveLegacyVaultId('Personal'))
  })
})
