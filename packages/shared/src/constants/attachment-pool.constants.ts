/** Attachments 根下的共享资源目录，不是会话附件文件夹 */
export const ATTACHMENT_POOL_FOLDER_NAMES = ['avatars', 'emojis', 'backgrounds'] as const

export type AttachmentPoolFolderName = (typeof ATTACHMENT_POOL_FOLDER_NAMES)[number]

export function isAttachmentPoolFolderName(name: string): boolean {
  return (ATTACHMENT_POOL_FOLDER_NAMES as readonly string[]).includes(name)
}
