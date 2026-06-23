import React from 'react'
import { useTranslation } from 'react-i18next'
import type { FileChangePartData } from '@baishou/shared'
import { basenameFromPath, fileChangeKindLabel, formatFileChangeStats } from './file-change.utils'
import styles from './FileChangeSummary.module.css'

export interface FileChangeSummaryProps {
  data: FileChangePartData
  expanded?: boolean
  onToggle?: () => void
  className?: string
}

export const FileChangeSummary: React.FC<FileChangeSummaryProps> = ({
  data,
  expanded = false,
  onToggle,
  className
}) => {
  const { t } = useTranslation()
  const stats = formatFileChangeStats(data.additions, data.deletions)
  const fileName = basenameFromPath(data.path)

  return (
    <button
      type="button"
      className={`${styles.summary} ${className ?? ''}`}
      onClick={onToggle}
      aria-expanded={expanded}
      disabled={!onToggle}
    >
      <span className={styles.chevron} data-expanded={expanded ? 'true' : 'false'} aria-hidden>
        ▶
      </span>
      <span className={styles.kind}>{fileChangeKindLabel(t, data.kind)}</span>
      <span className={styles.path} title={data.path}>
        {fileName}
      </span>
      <span className={styles.stats}>{stats}</span>
    </button>
  )
}
