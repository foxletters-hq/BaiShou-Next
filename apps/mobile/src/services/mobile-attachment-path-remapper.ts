import { registerAttachmentPathRemapper, clearAttachmentPathRemapper } from '@baishou/ai'
import { remapAttachmentPathToStorageRoot } from '@baishou/shared'

let cachedStorageRoot = ''

/** 刷新 AI 读附件时的跨端路径重映射（桌面绝对路径 → 本机 storageRoot） */
export async function refreshMobileAttachmentPathRemapper(
  getRootDirectory: () => Promise<string>
): Promise<string> {
  cachedStorageRoot = (await getRootDirectory()).replace(/\\/g, '/').replace(/\/+$/, '')
  registerAttachmentPathRemapper((filePath) => {
    if (!cachedStorageRoot) return filePath
    return remapAttachmentPathToStorageRoot(filePath, cachedStorageRoot)
  })
  return cachedStorageRoot
}

export function resetMobileAttachmentPathRemapper(): void {
  cachedStorageRoot = ''
  clearAttachmentPathRemapper()
}
