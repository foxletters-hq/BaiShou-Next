import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('mobile attachment management emoji wiring', () => {
  it('should list sticker files from the emoji pool and prune group config on delete', () => {
    const src = readFileSync(join(here, '../AttachmentManagementSection.tsx'), 'utf8')
    expect(src).toContain('listEmojiAttachmentFiles')
    expect(src).toContain('mergeEmojiAttachmentCatalog')
    expect(src).toContain('onDeleteEmojiAttachments')
    expect(src).toContain('removeEmojisByRelativePaths')
    expect(src).toContain('publishEmojiToolConfig')
    expect(src).not.toContain('deleteBatch(relativePaths)')
    const service = readFileSync(
      join(here, '../../../../services/mobile-attachment-manager.service.ts'),
      'utf8'
    )
    const emoji = readFileSync(
      join(here, '../../../../services/mobile-attachment-manager.emoji.ts'),
      'utf8'
    )
    expect(service).toContain('listMobileEmojiAttachmentFiles')
    expect(emoji).toContain('listMobileEmojiAttachmentFiles')
  })
})
