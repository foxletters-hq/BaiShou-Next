import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../useBranchSession.ts'),
  'utf8'
)

describe('useBranchSession vault chrome', () => {
  it('should branch companion sessions with the live vault helper', () => {
    expect(src).toContain('loadMobileSessionInActiveVault')
    expect(src).toContain('resolveMobileActiveVaultId')
    expect(src).not.toContain('assertMobileSessionInActiveVault')
  })
})
