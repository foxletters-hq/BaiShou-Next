import type { IAttachmentManager } from './attachment-manager.types'

export type AttachmentCleanupPart = { type?: string; data?: unknown }

/**
 * 按已取出的 parts 清理会话附件目录中的本地文件。
 * 调用方须在删库前取 parts；本函数失败时吞掉错误，避免阻断删消息主流程。
 */
export async function cleanupAttachmentsForParts(
  attachmentManager: Pick<IAttachmentManager, 'deleteFilesReferencedByParts'>,
  sessionId: string,
  parts: ReadonlyArray<AttachmentCleanupPart>
): Promise<void> {
  if (parts.length === 0) return
  try {
    await attachmentManager.deleteFilesReferencedByParts(sessionId, parts)
  } catch (e) {
    console.error('[cleanupAttachmentsForParts] Failed to delete session attachment files:', e)
  }
}
