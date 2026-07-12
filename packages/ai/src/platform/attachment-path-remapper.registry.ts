export type AttachmentPathRemapper = (filePath: string) => string

let injectedRemapper: AttachmentPathRemapper | null = null

/** 桌面/移动在启动时注入：把跨端绝对路径映射到本机存储根 */
export function registerAttachmentPathRemapper(remapper: AttachmentPathRemapper): void {
  injectedRemapper = remapper
}

export function clearAttachmentPathRemapper(): void {
  injectedRemapper = null
}

export function applyAttachmentPathRemapper(filePath: string): string {
  if (!filePath) return ''
  return injectedRemapper ? injectedRemapper(filePath) : filePath
}
