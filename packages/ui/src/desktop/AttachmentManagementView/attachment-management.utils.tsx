import React from 'react'
import { File, FileImage, FileVideo, FileText, FileAudio, FileCode } from 'lucide-react'
import styles from './AttachmentManagementView.module.css'

export function formatSize(mb: number | undefined | null) {
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

export function getFileIcon(name: string, size = 18) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'heic'].includes(ext)) {
    return <FileImage size={size} className={`${styles.fileIcon} ${styles.iconImage}`} />
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
    return <FileVideo size={size} className={`${styles.fileIcon} ${styles.iconVideo}`} />
  }
  if (ext === 'pdf') {
    return <FileText size={size} className={`${styles.fileIcon} ${styles.iconPdf}`} />
  }
  if (['txt', 'md', 'json', 'js', 'ts', 'tsx', 'html', 'css', 'yaml', 'yml'].includes(ext)) {
    return <FileCode size={size} className={`${styles.fileIcon} ${styles.iconText}`} />
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <File size={size} className={`${styles.fileIcon} ${styles.iconArchive}`} />
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
    return <FileAudio size={size} className={`${styles.fileIcon} ${styles.iconAudio}`} />
  }
  return <File size={size} className={styles.fileIcon} />
}

export function isImageFile(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
}

/** Electron 桌面端通过 local 协议直接加载磁盘图片，避免 IPC 传输 base64 */
export function toLocalFileUrl(filePath: string): string {
  if (!filePath) return ''
  if (
    filePath.startsWith('local://') ||
    filePath.startsWith('data:') ||
    filePath.startsWith('blob:') ||
    filePath.startsWith('http://') ||
    filePath.startsWith('https://')
  ) {
    return filePath
  }
  return `local:///${filePath.replace(/\\/g, '/')}`
}

export function supportsLocalFileImagePreview(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as Window & {
    api?: { attachment?: { getThumbnail?: unknown } }
    electron?: { ipcRenderer?: { invoke?: unknown } }
  }
  return Boolean(w.api?.attachment?.getThumbnail ?? w.electron?.ipcRenderer?.invoke)
}
