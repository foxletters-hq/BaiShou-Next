import { describe, expect, it } from 'vitest'
import { deriveLegacyVaultId } from '../vault-id.util'
import {
  evaluateSessionVaultAccess,
  resolveSessionFlushTargetVault,
  resolveSessionVaultCandidateIds,
  sessionBelongsToActiveVault,
  sessionBelongsToActiveVaultId
} from '../session-vault.util'

describe('resolveSessionFlushTargetVault', () => {
  it('优先使用磁盘上存在的会话自身 vault', () => {
    expect(
      resolveSessionFlushTargetVault('Personal', 'Personal85', ['Personal', 'Personal85'])
    ).toBe('Personal')
  })

  it('会话 vault 不在磁盘时回退到活跃 vault', () => {
    expect(resolveSessionFlushTargetVault('Gone', 'Personal85', ['Personal85'])).toBe('Personal85')
  })

  it('default/空 vault 使用活跃 vault', () => {
    expect(resolveSessionFlushTargetVault('default', 'Personal85', ['Personal85'])).toBe(
      'Personal85'
    )
    expect(resolveSessionFlushTargetVault(null, 'Personal85', ['Personal85'])).toBe('Personal85')
  })
})

describe('sessionBelongsToActiveVaultId', () => {
  it('同 vault_id 允许访问', () => {
    expect(sessionBelongsToActiveVaultId('vlt_a', 'vlt_a')).toBe(true)
  })

  it('跨仓拒绝', () => {
    expect(sessionBelongsToActiveVaultId('vlt_a', 'vlt_b')).toBe(false)
  })

  it('缺任一侧 fail-closed', () => {
    expect(sessionBelongsToActiveVaultId('', 'vlt_a')).toBe(false)
    expect(sessionBelongsToActiveVaultId('vlt_a', '')).toBe(false)
    expect(sessionBelongsToActiveVaultId(null, 'vlt_a')).toBe(false)
    expect(sessionBelongsToActiveVaultId('vlt_a', null)).toBe(false)
  })
})

describe('sessionBelongsToActiveVault', () => {
  it('匹配同名 vault', () => {
    expect(sessionBelongsToActiveVault('Personal85', 'Personal85')).toBe(true)
    expect(sessionBelongsToActiveVault('Personal', 'Personal85')).toBe(false)
  })
})

describe('resolveSessionVaultCandidateIds', () => {
  const personalLegacyId = deriveLegacyVaultId('Personal')

  it('should exclude Personal legacy id when Personal exists as another registered vault', () => {
    const candidates = resolveSessionVaultCandidateIds({
      activeVault: { id: 'vlt_52f1ae2cda9f36e5', name: 'Personal45' },
      allVaults: [
        { id: personalLegacyId, name: 'Personal' },
        { id: 'vlt_52f1ae2cda9f36e5', name: 'Personal45' }
      ]
    })

    expect(candidates).toEqual(['vlt_52f1ae2cda9f36e5', deriveLegacyVaultId('Personal45')])
    expect(candidates).not.toContain(personalLegacyId)
  })

  it('should exclude Personal legacy id for a custom vault when Personal exists', () => {
    const candidates = resolveSessionVaultCandidateIds({
      activeVault: { id: 'vlt_work', name: 'Work' },
      allVaults: [
        { id: 'vlt_personal_rand', name: 'Personal' },
        { id: 'vlt_work', name: 'Work' }
      ]
    })

    expect(candidates).toEqual(['vlt_work', deriveLegacyVaultId('Work')])
    expect(candidates).not.toContain(personalLegacyId)
  })

  it('should exclude Personal legacy id across multi-vault custom setups without Personal', () => {
    const candidates = resolveSessionVaultCandidateIds({
      activeVault: { id: 'vlt_work', name: 'Work' },
      allVaults: [
        { id: 'vlt_work', name: 'Work' },
        { id: 'vlt_life', name: 'Life' }
      ]
    })

    expect(candidates).toEqual(['vlt_work', deriveLegacyVaultId('Work')])
    expect(candidates).not.toContain(personalLegacyId)
  })

  it('should include Personal legacy id for a sole Personal-derivative vault', () => {
    const candidates = resolveSessionVaultCandidateIds({
      activeVault: { id: 'vlt_52f1ae2cda9f36e5', name: 'Personal45' },
      allVaults: [{ id: 'vlt_52f1ae2cda9f36e5', name: 'Personal45' }]
    })

    expect(candidates).toEqual([
      'vlt_52f1ae2cda9f36e5',
      deriveLegacyVaultId('Personal45'),
      personalLegacyId
    ])
  })

  it('should include Personal legacy id when Personal itself is active with a random id', () => {
    const candidates = resolveSessionVaultCandidateIds({
      activeVault: { id: 'vlt_personal_rand', name: 'Personal' },
      allVaults: [
        { id: 'vlt_personal_rand', name: 'Personal' },
        { id: 'vlt_work', name: 'Work' }
      ]
    })

    expect(candidates).toEqual(['vlt_personal_rand', personalLegacyId])
  })

  it('should include Personal legacy id for a sole renamed vault to preserve legacy sessions', () => {
    const candidates = resolveSessionVaultCandidateIds({
      activeVault: { id: 'vlt_renamed', name: 'MyDiary' },
      allVaults: [{ id: 'vlt_renamed', name: 'MyDiary' }]
    })

    expect(candidates).toEqual(['vlt_renamed', deriveLegacyVaultId('MyDiary'), personalLegacyId])
  })
})

describe('evaluateSessionVaultAccess', () => {
  const personalLegacyId = deriveLegacyVaultId('Personal')

  it('should deny Personal session when active vault is Personal45 and Personal also exists', () => {
    const evaluation = evaluateSessionVaultAccess(personalLegacyId, {
      activeVault: { id: 'vlt_52f1ae2cda9f36e5', name: 'Personal45' },
      allVaults: [
        { id: personalLegacyId, name: 'Personal' },
        { id: 'vlt_52f1ae2cda9f36e5', name: 'Personal45' }
      ]
    })

    expect(evaluation.decision).toBe('deny-other-vault')
  })

  it('should allow self-heal when session uses legacy Personal id and no other Personal vault exists', () => {
    const evaluation = evaluateSessionVaultAccess(personalLegacyId, {
      activeVault: { id: 'vlt_52f1ae2cda9f36e5', name: 'Personal45' },
      allVaults: [{ id: 'vlt_52f1ae2cda9f36e5', name: 'Personal45' }]
    })

    expect(evaluation.decision).toBe('self-heal')
  })
})
