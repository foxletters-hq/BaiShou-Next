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

export function formatRelativeTime(
  date: Date,
  t: (key: string, fallback: string) => string
): string {
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return t('common.just_now', '刚刚')
  if (diff < 3600) return `${Math.floor(diff / 60)} ${t('common.minutes_ago', '分钟前')}`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('common.hours_ago', '小时前')}`
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
