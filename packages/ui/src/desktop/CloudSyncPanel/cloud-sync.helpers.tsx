import React from 'react'
import { Cloud, Globe, Folder } from 'lucide-react'

export function getTargetIcon(target: string, size = 18): React.ReactNode {
  if (target === 's3') return <Cloud size={size} strokeWidth={2} />
  if (target === 'webdav') return <Globe size={size} strokeWidth={2} />
  return <Folder size={size} strokeWidth={2} />
}

export function getTargetColor(target: string): string {
  if (target === 's3') return '#0ea5e9'
  if (target === 'webdav') return '#8b5cf6'
  return '#64748b'
}
