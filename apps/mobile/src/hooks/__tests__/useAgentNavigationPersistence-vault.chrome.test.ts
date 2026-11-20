import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '../useAgentNavigationPersistence.ts'), 'utf8')
const assistantsSrc = readFileSync(
  join(here, '../../screens/AgentScreen/hooks/useAgentAssistants.ts'),
  'utf8'
)
const modelSrc = readFileSync(join(here, '../useAgentModel.ts'), 'utf8')

describe('useAgentNavigationPersistence vault chrome', () => {
  it('should restore companion sessions through the live vault helper', () => {
    expect(src).toContain('loadMobileSessionInActiveVault')
    expect(src).not.toContain('sessionBelongsToActiveVaultId')
  })

  it('should pass vault candidate ids on every sessionManager.list call to avoid fail-closed drops', () => {
    expect(src).toContain('resolveMobileSessionVaultCandidateIds(services)')
    expect(src).not.toMatch(/sessionManager\.list\(\s*1\s*,\s*0\s*,\s*[^,)]+\s*\)/)
    expect(assistantsSrc).toContain('resolveMobileSessionVaultCandidateIds(services)')
    expect(assistantsSrc).not.toMatch(/sessionManager\.list\(\s*1\s*,\s*0\s*,\s*[^,)]+\s*\)/)
  })

  it('should bind navigation persistence snapshots to the hydrated vault key and guard vaultSwitching', () => {
    expect(src).toContain('hydratedVaultKeyRef')
    expect(src).toContain('vaultSwitchingRef')
    expect(modelSrc).toContain('vaultSwitching')
  })
})
