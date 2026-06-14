import { describe, it, expect } from 'vitest'
import {
  sanitizeVaultDirectoryName,
  sanitizeVaultNameForPathSegment,
  validateVaultName,
  vaultDirectoryBasename
} from '../vault-name.util'

describe('sanitizeVaultDirectoryName', () => {
  it('returns plain names unchanged', () => {
    expect(sanitizeVaultDirectoryName('Personal')).toBe('Personal')
    expect(sanitizeVaultDirectoryName('Work 2026')).toBe('Work 2026')
  })

  it('replaces path separators with underscores', () => {
    expect(sanitizeVaultDirectoryName('foo/bar')).toBe('foo_bar')
    expect(sanitizeVaultDirectoryName('foo\\bar')).toBe('foo_bar')
  })

  it('replaces URI-unsafe and control characters', () => {
    expect(sanitizeVaultDirectoryName('a:b%c#d?e*f')).toBe('a_b_c_d_e_f')
    expect(sanitizeVaultDirectoryName('line\nbreak')).toBe('line_break')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeVaultDirectoryName('  Personal  ')).toBe('Personal')
  })

  it('falls back to "vault" when result would be empty', () => {
    expect(sanitizeVaultDirectoryName('')).toBe('vault')
    expect(sanitizeVaultDirectoryName('   ')).toBe('vault')
  })

  it('matches legacy vaultDirectoryBasename and path-segment helper', () => {
    const samples = ['Personal', 'a/b', 'x:y%z', '  spaced  ', '***']
    for (const name of samples) {
      expect(vaultDirectoryBasename(name)).toBe(sanitizeVaultDirectoryName(name))
      expect(sanitizeVaultNameForPathSegment(name)).toBe(sanitizeVaultDirectoryName(name))
    }
  })

  it('is stricter than desktop-only slash replacement', () => {
    expect(sanitizeVaultDirectoryName('My:Vault')).toBe('My_Vault')
    expect('My:Vault'.replace(/[/\\]/g, '_')).toBe('My:Vault')
  })
})

describe('validateVaultName vs sanitizeVaultDirectoryName', () => {
  it('rejects chars that sanitization would rewrite', () => {
    expect(validateVaultName('foo/bar').ok).toBe(false)
    expect(sanitizeVaultDirectoryName('foo/bar')).toBe('foo_bar')
  })
})
