import type { ViewProps } from 'react-native'

export interface AttachmentFileItem {
  name: string
  path: string
  sizeMB: number
  birthtime: string
}

export interface SessionAttachmentGroup {
  sessionId: string
  sessionTitle?: string
  isOrphan: boolean
  totalSizeMB: number
  fileCount: number
  files: AttachmentFileItem[]
}

export interface DiaryAttachmentFileItem {
  name: string
  path: string
  relativePath: string
  sizeMB: number
  birthtime: string
  yearMonth: string
  isOrphan: boolean
}

export interface AttachmentManagementViewProps extends ViewProps {
  attachments: SessionAttachmentGroup[]
  onDeleteSelected: (ids: string[]) => Promise<void>
  onDeleteFile?: (sessionId: string, fileName: string) => Promise<void>
  onOpenFileLocation?: (path: string) => Promise<void>
  diaryAttachments?: DiaryAttachmentFileItem[]
  onDeleteDiaryAttachment?: (filePath: string) => Promise<void>
  /** 将磁盘绝对路径转为可展示的 file:// URI */
  toDisplayUri?: (path: string) => string
  /** 移动端：从 vault 读取图片为 data URI；purpose=thumbnail 用于列表缩略图，preview 用于全屏 */
  loadImageUri?: (
    filePath: string,
    purpose?: 'thumbnail' | 'preview'
  ) => Promise<string | null>
  /** 分页 / Tab / 折叠变化时清空图片内存缓存 */
  onImageCacheScopeChange?: () => void
  isLoading?: boolean
  onRefresh?: () => Promise<void>
}
