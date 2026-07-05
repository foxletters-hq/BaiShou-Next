import React from 'react'
import type { LucideProps } from 'lucide-react-native'
import { File, FileAudio, FileCode, FileImage, FileText, FileVideo } from 'lucide-react-native'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'

export function formatSize(mb: number | undefined | null): string {
  if (mb === undefined || mb === null || isNaN(mb)) return '0 B'
  if (mb <= 0) return '0 B'
  if (mb < 1) return (mb * 1024).toFixed(2) + ' KB'
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB'
  return mb.toFixed(2) + ' MB'
}

export function formatAttachmentClearCompletedMessage(
  t: (key: string, options?: Record<string, unknown>) => string,
  sizeMB: number
): string {
  const size = formatSize(sizeMB)
  return t('settings.attachment_clear_completed', {
    size,
    defaultValue: `清理完成，共释放 ${size} 空间`
  })
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

function resolveFileIconComponent(name: string): React.ComponentType<LucideProps> {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'heic'].includes(ext)) return FileImage
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return FileVideo
  if (ext === 'pdf') return FileText
  if (['txt', 'md', 'json', 'js', 'ts', 'tsx', 'html', 'css', 'yaml', 'yml'].includes(ext)) {
    return FileCode
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return File
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return FileAudio
  return File
}

export function getFileIcon(name: string, size = 18, color?: string) {
  const Icon = resolveFileIconComponent(name)
  return <Icon size={size} color={color} strokeWidth={DEFAULT_STROKE_WIDTH} />
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
