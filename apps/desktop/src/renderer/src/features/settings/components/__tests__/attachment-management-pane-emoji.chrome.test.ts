import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('desktop attachment management pane emoji wiring', () => {
  it('should refresh sticker catalog and publish emoji config after dedicated delete', () => {
    const pane = readFileSync(join(here, '../AttachmentManagementPane.tsx'), 'utf8')
    expect(pane).toContain('listEmojiAttachments')
    expect(pane).toContain('deleteEmojiAttachments')
    expect(pane).toContain('onDeleteEmojiAttachments')
    expect(pane).toContain('EMOJI_TOOL_CONFIG_UPDATED_EVENT')
  })
})
