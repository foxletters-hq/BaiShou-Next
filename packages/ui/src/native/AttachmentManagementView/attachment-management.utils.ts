export function formatSize(mb: number | undefined | null): string {
  if (mb === undefined || mb === null || isNaN(mb)) return '0 B'
  if (mb <= 0) return '0 B'
  if (mb < 1) return (mb * 1024).toFixed(2) + ' KB'
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB'
  return mb.toFixed(2) + ' MB'
}

export function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext)
}

export function guessImageMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    case 'heic':
      return 'image/heic'
    case 'svg':
      return 'image/svg+xml'
    default:
      return 'image/jpeg'
  }
}

export type FileIconName =
  | 'image'
  | 'videocam'
  | 'picture-as-pdf'
  | 'description'
  | 'folder-zip'
  | 'audiotrack'
  | 'insert-drive-file'

export function getFileIconName(name: string): FileIconName {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'heic'].includes(ext)) return 'image'
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return 'videocam'
  if (ext === 'pdf') return 'picture-as-pdf'
  if (['txt', 'md', 'json', 'js', 'ts', 'tsx', 'html', 'css', 'yaml', 'yml'].includes(ext)) {
    return 'description'
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'folder-zip'
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audiotrack'
  return 'insert-drive-file'
}

export function defaultToDisplayUri(filePath: string): string {
  if (!filePath) return ''
  if (
    filePath.startsWith('file://') ||
    filePath.startsWith('content://') ||
    filePath.startsWith('http://') ||
    filePath.startsWith('https://')
  ) {
    return filePath
  }
  return `file://${filePath}`
}
