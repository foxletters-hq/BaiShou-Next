import React from 'react'
import type { RagVectorKindFilter } from '@baishou/shared'
import { RagEmbeddedFilesTable } from './RagEmbeddedFilesTable'
import type { RagEntry } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryEntriesListProps {
  entries: RagEntry[]
  searchQuery: string
  sourceKind?: RagVectorKindFilter
  activeMenuId: string | null
  setActiveMenuId: (id: string | null) => void
  formatDate: (entry: RagEntry) => string
  onEditEntry?: (entry: RagEntry) => Promise<void>
  onDeleteEntry?: (id: string) => Promise<void>
}

export const RagMemoryEntriesList: React.FC<RagMemoryEntriesListProps> = ({
  entries,
  searchQuery,
  sourceKind,
  activeMenuId,
  setActiveMenuId,
  formatDate,
  onEditEntry,
  onDeleteEntry
}) => (
  <div
    className={
      entries.length === 0
        ? `${styles.entriesListContainer} ${styles.entriesListContainerFill}`
        : styles.entriesListContainer
    }
  >
    <RagEmbeddedFilesTable
      entries={entries}
      searchQuery={searchQuery}
      sourceKind={sourceKind}
      activeMenuId={activeMenuId}
      setActiveMenuId={setActiveMenuId}
      onEditEntry={onEditEntry}
      onDeleteEntry={onDeleteEntry}
      formatDate={formatDate}
    />
  </div>
)
