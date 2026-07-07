import type { LucideIcon } from 'lucide-react-native'
import { Cloud, Folder, Globe } from 'lucide-react-native'

export function getTargetIcon(type: string): LucideIcon {
  switch (type) {
    case 'webdav':
      return Globe
    case 's3':
      return Cloud
    default:
      return Folder
  }
}

export function getTargetColor(type: string) {
  switch (type) {
    case 'webdav':
      return '#0ea5e9'
    case 's3':
      return '#f59e0b'
    default:
      return '#10b981'
  }
}

export function formatRecordSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
