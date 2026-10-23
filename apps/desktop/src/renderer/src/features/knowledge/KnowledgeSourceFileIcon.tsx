import React from 'react'
import { File, FileCode, FileText, Link2 } from 'lucide-react'
import { knowledgeSourceFileExtension } from './knowledge-detail-labels.util'
import styles from './KnowledgePage.module.css'

export function KnowledgeSourceFileIcon({
  kind,
  fileName,
  size = 18
}: {
  kind: string
  fileName: string
  size?: number
}): React.ReactNode {
  if (kind === 'url')
    return <Link2 size={size} className={`${styles.fileTypeIcon} ${styles.iconUrl}`} />
  if (kind === 'note' || kind === 'text') {
    return <FileText size={size} className={`${styles.fileTypeIcon} ${styles.iconText}`} />
  }
  const ext = knowledgeSourceFileExtension(fileName)
  if (ext === 'pdf') {
    return <FileText size={size} className={`${styles.fileTypeIcon} ${styles.iconPdf}`} />
  }
  if (['md', 'markdown', 'txt'].includes(ext)) {
    return <FileCode size={size} className={`${styles.fileTypeIcon} ${styles.iconText}`} />
  }
  if (['json', 'js', 'ts', 'tsx', 'html', 'css', 'yaml', 'yml'].includes(ext)) {
    return <FileCode size={size} className={`${styles.fileTypeIcon} ${styles.iconCode}`} />
  }
  return <File size={size} className={styles.fileTypeIcon} />
}
