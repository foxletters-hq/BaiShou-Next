import {
  mapSavedAttachmentsForUi,
  resolveAttachmentAbsolutePath,
  type MockChatAttachment
} from '@baishou/shared'

function toMobileAttachmentFilePath(filePath?: string): string {
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
  attachments: readonly unknown[] | undefined
): MockChatAttachment[] | undefined {
  const mapped = mapSavedAttachmentsForUi(attachments)
  if (!mapped) return undefined
  return mapped.map((att) => ({
    ...att,
    filePath: toMobileAttachmentFilePath(att.filePath)
  }))
}
