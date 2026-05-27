export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getMimeTypeLabel(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'IMG'
  if (mimeType.startsWith('audio/')) return 'AUD'
  if (mimeType.startsWith('video/')) return 'VID'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('text')) return 'TXT'
  return 'FILE'
}
