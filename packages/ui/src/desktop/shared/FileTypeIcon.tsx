import React from 'react'
import { File, FileAudio, FileCode, FileImage, FileText, FileVideo } from 'lucide-react'
import styles from './FileTypeIcon.module.css'

function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() || name
  const idx = base.lastIndexOf('.')
  if (idx <= 0 || idx === base.length - 1) return ''
  return base.slice(idx + 1).toLowerCase()
}

/** 按扩展名返回着色文件类型图标（对齐知识库素材 / 附件管理） */
export function getFileTypeIcon(fileName: string, size = 18): React.ReactNode {
  const ext = fileExtension(fileName)
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'heic'].includes(ext)) {
    return <FileImage size={size} className={`${styles.fileTypeIcon} ${styles.iconImage}`} />
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
    return <FileVideo size={size} className={`${styles.fileTypeIcon} ${styles.iconVideo}`} />
  }
  if (ext === 'pdf') {
    return <FileText size={size} className={`${styles.fileTypeIcon} ${styles.iconPdf}`} />
  }
  if (['md', 'markdown', 'txt'].includes(ext)) {
    return <FileCode size={size} className={`${styles.fileTypeIcon} ${styles.iconText}`} />
  }
  if (['json', 'js', 'ts', 'tsx', 'html', 'css', 'yaml', 'yml'].includes(ext)) {
    return <FileCode size={size} className={`${styles.fileTypeIcon} ${styles.iconCode}`} />
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <File size={size} className={`${styles.fileTypeIcon} ${styles.iconArchive}`} />
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
    return <FileAudio size={size} className={`${styles.fileTypeIcon} ${styles.iconAudio}`} />
  }
  return <File size={size} className={styles.fileTypeIcon} />
}
