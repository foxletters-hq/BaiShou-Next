import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'useAgentAssistants.ts'),
  'utf8'
)

describe('useAgentAssistants refresh chrome', () => {
  it('should reload partners after vault revision or ecosystem resync', () => {
    expect(src).not.toContain('vaultRevision: _vaultRevision')
    expect(src).not.toContain('ecosystemResyncEpoch: _ecosystemResyncEpoch')
    expect(src).toContain('lastVaultRevisionRef')
    expect(src).toContain('lastEcosystemResyncEpochRef')
    expect(src).toContain('[vaultRevision, ecosystemResyncEpoch, loadAssistants]')
  })

  it('should reload when vault switching finishes', () => {
    expect(src).toMatch(/\}, \[dbReady, services, storageIndexing, vaultSwitching\]\)/)
  })

  it('should not wipe the partner list when avatar hydration fails', () => {
    const catchStart = src.indexOf('} catch (e) {')
    expect(catchStart).toBeGreaterThan(-1)
    const catchBlock = src.slice(catchStart, src.indexOf('}, [dbReady', catchStart))
    expect(catchBlock).not.toContain('setAssistants([])')
    expect(catchBlock).toContain('console.warn')
  })
})
