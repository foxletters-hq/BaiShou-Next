import { ipcMain } from 'electron'
import { emojiService } from '../services/emoji.service'

export function registerEmojiIPC() {
  // Pick and import emoji files via system file dialog
  // Returns EmojiImportResult[] with originalName and possible error per file
  ipcMain.handle('emoji:pick-and-import', async () => {
    return await emojiService.pickAndImportEmojis()
  })

  // List all emoji files
  ipcMain.handle('emoji:list', async () => {
    return await emojiService.listEmojis()
  })

  // Resolve a single emoji relative path to local:// URI
  ipcMain.handle('emoji:resolve-path', async (_, relativePath: string) => {
    return await emojiService.resolveEmojiPath(relativePath)
  })

  // Resolve multiple emoji paths
  ipcMain.handle('emoji:resolve-paths', async (_, relativePaths: string[]) => {
    return await emojiService.resolveEmojiPaths(relativePaths)
  })

  // Delete an emoji file
  ipcMain.handle('emoji:delete', async (_, relativePath: string) => {
    return await emojiService.deleteEmoji(relativePath)
  })
}