import { describe, expect, it } from 'vitest'
import {
  resolveSessionFlushTargetVault,
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
