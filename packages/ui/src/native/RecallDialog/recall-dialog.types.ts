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
  onSearch: (query: string, tab: 'diary' | 'memory', mode?: 'semantic' | 'text') => void
  onInject: (selectedItems: RecallItem[]) => void
  searchMode?: 'semantic' | 'text'
  onToggleSearchMode?: () => void
  lookbackMonths?: number
  onMonthsChanged?: (val: number) => void
  onCopyContext?: () => void
  onCopyDiarySnippet?: (snippet: string) => void
}

export type RecallTab = 'diary' | 'memory'

export interface SimilarityColorSet {
  bg: string
  border: string
  fg: string
}
