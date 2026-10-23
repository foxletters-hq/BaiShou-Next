import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const hook = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'useDiaryPendingStatus.ts'),
  'utf8'
)

describe('mobile diary pending status', () => {
  it('should restore organize snapshot after tab switch instead of wiping on refresh error', () => {
    expect(hook).toContain('peekOrganizePendingSnapshot')
    expect(hook).toContain('hydrateOrganizePendingSnapshot')
    expect(hook).toContain('getOrganizePendingSnapshot')
    expect(hook).toContain('subscribeMobilePendingEmbedCountsChanged')
    expect(hook).toContain('loadDiaryPendingStatus')
    expect(hook).toContain('resolveDiaryPendingStatusRefresh')
    expect(hook).toContain('shouldHydrateDiaryPendingSnapshot')
    expect(hook).toContain('liveAppliedRef')
    expect(hook).not.toContain('shadowConnectionManager.getDb()')
    expect(hook).not.toContain('mobileListPendingReextract')
    expect(hook).not.toContain('setPendingEmbedCount(0)')
    expect(hook).not.toContain('setRagConfigured(false)')
  })
})

describe('mobile diary pending organize count', () => {
  it('should count unique diary articles on the status bar instead of summing queues', () => {
    const bar = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'DiaryPendingStatusBar.tsx'),
      'utf8'
    )
    expect(bar).toContain('diaryPendingOrganizeCount')
    expect(bar).not.toContain('pendingGraphCount : 0) + (showEmbed')
  })
})
