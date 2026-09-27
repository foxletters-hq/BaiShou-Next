import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('native attachment management emoji pane', () => {
  it('should switch sticker files with SegmentedControl instead of mixing them into session groups', () => {
    const view = read('../AttachmentManagementView.tsx')
    expect(view).toContain('SegmentedControl')
    expect(view).toContain("value: 'emoji'")
    expect(view).toContain('attachment_pane_emoji')
    expect(view).toContain('EmojiAttachmentPane')
  })

  it('should prune sticker groups through onDeleteEmojiAttachments', () => {
    const types = read('../attachment-management.types.ts')
    const hook = read('../useAttachmentManagementView.ts')
    expect(types).toContain('onDeleteEmojiAttachments')
    expect(hook).toContain('useAttachmentEmojiState')
  })
})
