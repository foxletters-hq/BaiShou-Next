import React from 'react'
import { useTranslation } from 'react-i18next'
import type { FileChangePartData } from '@baishou/shared'
import styles from './FileChangePreview.module.css'

export interface FileChangePreviewProps {
  data: FileChangePartData
  className?: string
}

export const FileChangePreview: React.FC<FileChangePreviewProps> = ({ data, className }) => {
  const { t } = useTranslation()

  if (!data.preview?.trim()) {
    return (
      <div className={`${styles.preview} ${styles.empty} ${className ?? ''}`}>
        {t('file_change.no_preview', '暂无预览内容')}
      </div>
    )
  }

  return (
    <pre className={`${styles.preview} ${className ?? ''}`}>
      <code>{data.preview}</code>
    </pre>
  )
}
