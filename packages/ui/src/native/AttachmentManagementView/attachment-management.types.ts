import type { ViewProps } from 'react-native'

export interface AttachmentItem {
  id: string
  filename: string
  sizeInBytes: number
  mimeType: string
  createdAt: number
}

export interface AttachmentManagementViewProps extends ViewProps {
  attachments: AttachmentItem[]
  onDelete: (ids: string[]) => Promise<void>
  onRefresh: () => Promise<void>
  isLoading?: boolean
}
