import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('desktop emoji attachment IPC', () => {
  it('should merge disk stickers with group config when listing emoji attachments', () => {
    const src = readFileSync(join(here, '../attachment.ipc.ts'), 'utf8')
    expect(src).toContain("ipcMain.handle('attachment:listEmojiAttachments'")
    expect(src).toContain('listEmojiAttachmentFiles')
    expect(src).toContain('mergeEmojiAttachmentCatalog')
    expect(src).toContain('tool_management_config')
  })

  it('should delete sticker files and prune emojiConfig in the same handler', () => {
    const src = readFileSync(join(here, '../attachment.ipc.ts'), 'utf8')
    expect(src).toContain("ipcMain.handle('attachment:deleteEmojiAttachments'")
    expect(src).toContain('deleteEmoji')
    expect(src).toContain('removeEmojisByRelativePaths')
  })
})
