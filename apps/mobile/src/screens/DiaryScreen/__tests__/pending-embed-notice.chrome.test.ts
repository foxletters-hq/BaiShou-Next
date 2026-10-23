import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const diary = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'DiaryScreen.tsx'),
  'utf8'
)
const hook = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'useDiaryPendingStatus.ts'),
  'utf8'
)

describe('mobile diary pending embed notice', () => {
  it('should keep only the bottom status bar instead of a completion popup', () => {
    expect(diary).toContain('DiaryPendingStatusBar')
    expect(diary).not.toContain('PendingEmbedNotice')
    expect(diary).not.toContain('pendingNotice')
    expect(hook).not.toContain('pendingNotice')
    expect(hook).not.toContain('shouldShowPendingEmbedReminder')
    expect(hook).not.toContain('lastPendingNotice')
  })
})
