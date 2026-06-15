import {
  mapSavedAttachmentsForUi,
  resolveAttachmentAbsolutePath,
  type MockChatAttachment
} from '@baishou/shared'

/** 将附件路径解析为移动端可加载的 file:// URI（兼容桌面同步过来的绝对路径） */
export function resolveMobileAttachmentFilePath(
  rawPath: string | undefined,
  storageRoot: string
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
  const abs = resolveAttachmentAbsolutePath(trimmed).replace(/\\/g, '/')

  if (abs.startsWith(`${root}/`) || abs === root) {
    return toFileUri(abs)
  }

  const relMatch = abs.match(/([^/]+)\/Attachments\/(.+)$/i)
  if (relMatch) {
    return toFileUri(`${root}/${relMatch[1]}/Attachments/${relMatch[2]}`)
  }

  if (/^[a-zA-Z]:\//.test(abs) || abs.startsWith('/')) {
    const marker = '/Attachments/'
    const markerIdx = abs.indexOf(marker)
    if (markerIdx > 0) {
      const vaultStart = abs.lastIndexOf('/', markerIdx - 1)
      if (vaultStart >= 0) {
        const rel = abs.slice(vaultStart + 1)
        return toFileUri(`${root}/${rel}`)
      }
    }
  }

  if (!abs.startsWith('/') && !/^[a-zA-Z]:/.test(abs)) {
    return toFileUri(`${root}/${abs.replace(/^\/+/, '')}`)
  }

  return toFileUri(abs)
}

function toMobileAttachmentFilePath(filePath?: string, storageRoot?: string): string {
  if (storageRoot) {
    return resolveMobileAttachmentFilePath(filePath, storageRoot)
  }
  if (!filePath) return ''
  if (
    filePath.startsWith('file://') ||
    filePath.startsWith('content://') ||
    filePath.startsWith('data:')
  ) {
    return filePath
  }
  const abs = resolveAttachmentAbsolutePath(filePath)
  if (!abs) return filePath
  return abs.startsWith('/') ? `file://${abs}` : `file:///${abs}`
}

export function mapSavedAttachmentsForMobileUi(
  attachments: readonly unknown[] | undefined,
  storageRoot?: string
): MockChatAttachment[] | undefined {
  const mapped = mapSavedAttachmentsForUi(attachments)
  if (!mapped) return undefined
  return mapped.map((att) => ({
    ...att,
    filePath: toMobileAttachmentFilePath(att.filePath, storageRoot)
  }))
}
