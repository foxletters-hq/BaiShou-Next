import React, { useState } from 'react'
import type { FileChangePartData } from '@baishou/shared'
import { FileChangeSummary } from './FileChangeSummary'
import { FileChangePreview } from './FileChangePreview'
import { FileChangeDiff } from './FileChangeDiff'
import styles from './FileChangeCard.module.css'

export type FileChangeExpandLevel = 'collapsed' | 'preview' | 'diff'

export interface FileChangeCardProps {
  data: FileChangePartData
  defaultExpanded?: FileChangeExpandLevel
  className?: string
}

export const FileChangeCard: React.FC<FileChangeCardProps> = ({
  data,
  defaultExpanded = 'collapsed',
  className
}) => {
  const [level, setLevel] = useState<FileChangeExpandLevel>(defaultExpanded)

  const handleToggle = () => {
    setLevel((prev) => {
      if (prev !== 'collapsed') return 'collapsed'
      // 有 diff 时一次展开到行级 diff，避免「先预览再点一次」
      if (data.diff?.trim()) return 'diff'
      if (data.preview?.trim()) return 'preview'
      return 'diff'
    })
  }

  return (
    <div className={`${styles.card} ${className ?? ''}`}>
      <FileChangeSummary data={data} expanded={level !== 'collapsed'} onToggle={handleToggle} />
      {level === 'preview' ? <FileChangePreview data={data} /> : null}
      {level === 'diff' ? <FileChangeDiff data={data} /> : null}
    </div>
  )
}
