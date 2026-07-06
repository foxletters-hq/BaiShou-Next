import path from 'node:path'
import { emojiVaultKeyToAttachmentsRelativePath, isEmojiVaultRelativePath } from '@baishou/shared'
import type { DesktopStoragePathService } from '../services/path.service'

export type AttachmentAllowedRoots = {
  attachmentsBase: string
  journalsBase: string
}

let allowedRootsPromise: Promise<AttachmentAllowedRoots> | null = null

export function getAttachmentAllowedRoots(
  pathService: DesktopStoragePathService
): Promise<AttachmentAllowedRoots> {
  if (!allowedRootsPromise) {
    allowedRootsPromise = Promise.all([
      pathService.getAttachmentsBaseDirectory(),
      pathService.getJournalsBaseDirectory()
    ]).then(([attachmentsBase, journalsBase]) => ({ attachmentsBase, journalsBase }))
  }
  return allowedRootsPromise
}

export function resetAttachmentAllowedRootsCache(): void {
  allowedRootsPromise = null
}

function isPathUnderRoot(targetPath: string, rootPath: string): boolean {
  const root = path.resolve(rootPath)
  const target = path.resolve(targetPath)
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function isPathUnderAllowedRoots(
  resolvedPath: string,
  roots: AttachmentAllowedRoots
): boolean {
  return (
    isPathUnderRoot(resolvedPath, roots.attachmentsBase) ||
    isPathUnderRoot(resolvedPath, roots.journalsBase)
  )
}

/** 将 IPC 入参（含 local:///emojis/ 相对键）解析为可校验的绝对路径 */
export async function resolveAttachmentInputPath(
  filePath: string,
  pathService: DesktopStoragePathService
): Promise<string> {
  const trimmed = filePath.trim()
  if (!trimmed) return ''

  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || (trimmed.startsWith('/') && !trimmed.startsWith('//'))) {
    return path.resolve(trimmed)
  }

  if (isEmojiVaultRelativePath(trimmed)) {
    const attachmentsRelative = emojiVaultKeyToAttachmentsRelativePath(trimmed)
    const vaultPath = await pathService.getActiveVaultPath()
    if (vaultPath && attachmentsRelative.startsWith('Attachments/')) {
      return path.join(vaultPath, attachmentsRelative.split('/').join(path.sep))
    }
    const emojisDir = await pathService.getEmojisDirectory()
    const filename = path.basename(attachmentsRelative)
    return path.join(emojisDir, filename)
  }

  return path.resolve(trimmed)
}
