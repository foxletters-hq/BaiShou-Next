export interface RecallItem {
  id: string
  type: 'diary' | 'memory'
  title: string
  snippet: string
  date: string
  similarity?: number
}

export interface NativeRecallDialogProps {
  isOpen: boolean
  onClose: () => void
  items: RecallItem[]
  isSearching?: boolean
  onSearch: (query: string, tab: 'diary' | 'memory') => void
  onInject: (selectedItems: RecallItem[]) => void
}

export type RecallTab = 'diary' | 'memory'

export interface SimilarityColorSet {
  bg: string
  border: string
  fg: string
}
