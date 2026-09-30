import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../useAgentSession.ts'),
  'utf8'
)

describe('useAgentSession vault chrome', () => {
  it('should create and gate companion sessions with the live vault id helper', () => {
    expect(src).toContain('resolveMobileActiveVaultId')
    expect(src).toContain('assertMobileSessionInActiveVault')
    expect(src).toContain("from '../utils/mobile-session-vault.util'")
    expect(src).not.toMatch(/getActiveVaultNameForContext\(\)[\s\S]{0,180}buildInsertSessionInput/)
  })
})
