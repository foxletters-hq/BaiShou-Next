import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'MemoryCenterScreen.tsx'),
  'utf8'
)

describe('mobile memory center chrome', () => {
  it('should drive organize from shared phase snapshot and batch embed', () => {
    expect(page).toContain('snapshotMemoryEmbedPhases')
    expect(page).toContain('batchEmbed')
    expect(page).toContain('resolveMemoryOrganizeAction')
    expect(page).toContain('writeMemoryOnboardingDismissed')
    expect(page).toContain('readActiveVaultSafely')
    expect(page).toContain('normalizeMemoryCenterRagConfig')
    expect(page).toContain('loadMemoryOrganizePending')
    expect(page).toContain('graph 与 embed-then-graph 都走 batchEmbed')
    expect(page).not.toContain('getActiveVault().catch')
    expect(page).not.toContain('mobileGraphExtractQueue.enqueue')
    expect(page).not.toContain('runExtract')
  })

  it('should refresh organize counts when a vector fragment is deleted', () => {
    expect(page).toContain('subscribeMobilePendingEmbedCountsChanged')
  })

  it('should send the user to graph pending review when suspects exist', () => {
    expect(page).toContain('useMobileSuspectCount')
    expect(page).toContain('requestGraphPendingFocus')
    expect(page).toContain('memory.review_suspects')
  })
})
