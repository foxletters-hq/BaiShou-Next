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
  })
})
