import React from 'react'
import { useTranslation } from 'react-i18next'
import type { FileChangePartData } from '@baishou/shared'
import styles from './FileChangeDiff.module.css'

export interface FileChangeDiffProps {
  data: FileChangePartData
  className?: string
}

function renderDiffLine(line: string, index: number): React.ReactNode {
  let lineClass = styles.context
  if (line.startsWith('+') && !line.startsWith('+++')) {
    lineClass = styles.add
  } else if (line.startsWith('-') && !line.startsWith('---')) {
    lineClass = styles.del
  } else if (line.startsWith('@@')) {
    lineClass = styles.hunk
  }

  return (
    <div key={index} className={lineClass}>
      {line}
    </div>
  )
}

export const FileChangeDiff: React.FC<FileChangeDiffProps> = ({ data, className }) => {
  const { t } = useTranslation()

  if (!data.diff?.trim()) {
    return (
      <div className={`${styles.diff} ${styles.empty} ${className ?? ''}`}>
        {t('file_change.no_diff', '暂无行级 diff')}
      </div>
    )
  }

  const lines = data.diff.split('\n')

  return (
    <div className={`${styles.diff} ${className ?? ''}`}>
      {lines.map(renderDiffLine)}
    </div>
  )
}
