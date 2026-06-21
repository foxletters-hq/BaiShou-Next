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
  path: string // 绝对物理路径 (用于打开位置/删除)
  relativePath: string // 相对 Journals 目录的路径 (如: 2026/05/attachment/pasted_123.png)
  sizeMB: number
  birthtime: string
  yearMonth: string // 格式: YYYY-MM
  isOrphan: boolean // 是否是孤立附件 (在同年月的所有日记中都没有被引用)
}

export interface AttachmentManagementViewProps {
  attachments: SessionAttachmentGroup[]
  onDeleteSelected: (ids: string[]) => Promise<void>
  onDeleteFile?: (sessionId: string, fileName: string) => Promise<void>
  onOpenFileLocation?: (path: string) => Promise<void>

  // ======= 日记附件相关的扩展属性 =======
  diaryAttachments?: DiaryAttachmentFileItem[]
  onDeleteDiaryAttachment?: (filePath: string) => Promise<void>
}
