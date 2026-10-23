import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8')
}

describe('desktop attachment management emoji pane', () => {
  it('should expose a third pane for sticker files separate from session attachments', () => {
    const view = read('../AttachmentManagementView.tsx')
    expect(view).toContain("value: 'emoji'")
    expect(view).toContain('attachment_pane_emoji')
    expect(view).toContain('EmojiAttachmentPane')
    expect(view).toContain('stretch')
  })

  it('should delete sticker files through a dedicated callback instead of session batch delete', () => {
    const types = read('../attachment-management.types.ts')
    const hook = read('../useAttachmentManagementView.ts')
    const pane = read('../EmojiAttachmentPane.tsx')
    expect(types).toContain('onDeleteEmojiAttachments')
    expect(types).toContain("AttachmentManagementPane = 'diary' | 'session' | 'emoji'")
    expect(hook).toContain('useAttachmentEmojiState')
    expect(pane).toContain('handleDeleteEmojiSelected')
    expect(pane).not.toContain('onDeleteSelected')
  })
})
