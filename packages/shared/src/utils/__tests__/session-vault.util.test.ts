import { describe, expect, it } from 'vitest'
import {
  resolveSessionFlushTargetVault,
  sessionBelongsToActiveVault
} from '../session-vault.util'

describe('resolveSessionFlushTargetVault', () => {
  it('优先使用磁盘上存在的会话自身 vault', () => {
    expect(resolveSessionFlushTargetVault('Personal', 'Personal85', ['Personal', 'Personal85'])).toBe(
      'Personal'
    )
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

describe('sessionBelongsToActiveVault', () => {
  it('匹配同名 vault', () => {
    expect(sessionBelongsToActiveVault('Personal85', 'Personal85')).toBe(true)
    expect(sessionBelongsToActiveVault('Personal', 'Personal85')).toBe(false)
  })
})
