export function resolveChatAttachmentSrc(filePath?: string | null): string {
  if (!filePath) return ''
  if (
    filePath.startsWith('blob:') ||
    filePath.startsWith('local://') ||
    filePath.startsWith('data:') ||
    filePath.startsWith('http://') ||
    filePath.startsWith('https://')
  ) {
    return filePath
  }
  return `local:///${filePath.replace(/\\/g, '/')}`
}

export { formatRelativeTime } from '../../shared/chat-bubble/format-relative-time.util'
