export interface DiaryAttachmentItem {
  id: string
  fileName: string
  filePath: string
  relativePath: string
  isImage: boolean
  isVideo: boolean
  isAudio: boolean
  size?: number
  previewUrl?: string
}

export interface AttachmentUploaderProps {
  date: Date
  attachments: DiaryAttachmentItem[]
  onAttachmentsChange: (attachments: DiaryAttachmentItem[]) => void
  onInsertAttachment: (attachment: DiaryAttachmentItem) => void
}
