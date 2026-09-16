import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const diary = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'DiaryScreen.tsx'),
  'utf8'
)
const notice = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'PendingEmbedNotice.tsx'),
  'utf8'
)

describe('mobile diary pending embed notice', () => {
  it('should open the memory vectors tab instead of a system alert', () => {
    expect(diary).toContain('PendingEmbedNotice')
    expect(diary).toContain("pathname: '/memory'")
    expect(diary).toContain("tab: 'vectors'")
    expect(notice).not.toContain('Alert.alert')
    expect(notice).toContain('memory.pending_embed_reminder_mute')
  })
})
