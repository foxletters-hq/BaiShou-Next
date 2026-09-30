import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../useAgentNavigationPersistence.ts'),
  'utf8'
)

describe('useAgentNavigationPersistence vault chrome', () => {
  it('should restore companion sessions through the live vault helper', () => {
    expect(src).toContain('loadMobileSessionInActiveVault')
    expect(src).not.toContain('sessionBelongsToActiveVaultId')
  })
})
