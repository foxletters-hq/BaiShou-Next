import React from 'react'
import { Cloud, Globe, Folder } from 'lucide-react'

export function getTargetIcon(target: string): React.ReactNode {
  if (target === 's3') return <Cloud size={20} strokeWidth={1.5} />
  if (target === 'webdav') return <Globe size={20} strokeWidth={1.5} />
  return <Folder size={20} strokeWidth={1.5} />
}

export function getTargetColor(target: string): string {
  if (target === 's3') return '#0ea5e9'
  if (target === 'webdav') return '#8b5cf6'
  return '#64748b'
}
