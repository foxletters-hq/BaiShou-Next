import {
  emojiVaultKeyToAttachmentsRelativePath,
  isEmojiVaultRelativePath,
  mapSavedAttachmentsForUi,
  remapAttachmentPathToStorageRoot,
  type MockChatAttachment
} from '@baishou/shared'

/** 将附件路径解析为移动端可加载的 file:// URI（兼容桌面同步过来的绝对路径） */
export function resolveMobileAttachmentFilePath(
  rawPath: string | undefined,
  storageRoot: string,
  attachmentsBasePath?: string
): string {
  if (!rawPath) return ''
  const trimmed = rawPath.trim()
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('content://')
  ) {
    return trimmed
  }

  const toFileUri = (abs: string): string => {
    if (abs.startsWith('file://')) return abs
    const normalized = abs.replace(/\\/g, '/')
    return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
  }

  const root = storageRoot.replace(/\\/g, '/').replace(/\/+$/, '')

  if (isEmojiVaultRelativePath(trimmed)) {
    const attachmentsRel = emojiVaultKeyToAttachmentsRelativePath(trimmed)
    const emojiFile = attachmentsRel.replace(/^Attachments\/emojis\//i, '')
    if (attachmentsBasePath?.trim()) {
      const base = attachmentsBasePath.replace(/\\/g, '/').replace(/\/+$/, '')
      return toFileUri(`${base}/emojis/${emojiFile}`)
    }
    return toFileUri(`${root}/${attachmentsRel}`)
  }

  const remapped = remapAttachmentPathToStorageRoot(trimmed, root)
  if (!remapped) return ''
  if (
    remapped.startsWith('http://') ||
    remapped.startsWith('https://') ||
    remapped.startsWith('data:') ||
    remapped.startsWith('content://')
  ) {
    return remapped
  }
  return toFileUri(remapped)
}

function toMobileAttachmentFilePath(
  filePath?: string,
  storageRoot?: string,
  attachmentsBasePath?: string
): string {
  if (storageRoot) {
    return resolveMobileAttachmentFilePath(filePath, storageRoot, attachmentsBasePath)
  }
  if (!filePath) return ''
  if (
    filePath.startsWith('file://') ||
    filePath.startsWith('content://') ||
    filePath.startsWith('data:')
  ) {
    return filePath
  }
  const remapped = remapAttachmentPathToStorageRoot(filePath, '')
  if (!remapped) return filePath
  return remapped.startsWith('/') ? `file://${remapped}` : `file:///${remapped}`
}

export function mapSavedAttachmentsForMobileUi(
  attachments: readonly unknown[] | undefined,
  storageRoot?: string,
  attachmentsBasePath?: string
): MockChatAttachment[] | undefined {
  const mapped = mapSavedAttachmentsForUi(attachments)
  if (!mapped) return undefined
  return mapped.map((att) => ({
    ...att,
    filePath: toMobileAttachmentFilePath(att.filePath, storageRoot, attachmentsBasePath)
  }))
}
