import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../agent-session.ipc.ts'),
  'utf8'
)

describe('agent-session.ipc vault isolation chrome', () => {
  it('should resolve session list vault candidates via shared multi-vault-safe helper', () => {
    expect(src).toContain('resolveSessionVaultCandidateIds')
    expect(src).toContain('evaluateSessionVaultAccess')
    expect(src).not.toContain("deriveLegacyVaultId('Personal')")
  })
})
