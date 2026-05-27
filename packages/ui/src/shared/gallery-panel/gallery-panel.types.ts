export interface GalleryImage {
  uri: string
  caption?: string
}

export interface SummaryItem {
  id?: number | string
  type: string
  startDate: string
  endDate: string
  content: string
  title?: string
  generatedAt?: string
}

export interface GalleryPanelProps {
  images?: GalleryImage[]
  onImagePress?: (uri: string) => void
  summaries?: SummaryItem[]
  onOpen?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onSave?: (id: string, content: string) => Promise<void>
}
