import React from 'react'
import { RagEmbeddedFilesTable } from './RagEmbeddedFilesTable'
import type { RagEntry } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryEntriesListProps {
  entries: RagEntry[]
  searchQuery: string
  activeMenuId: string | null
  setActiveMenuId: (id: string | null) => void
  formatDate: (entry: RagEntry) => string
  onEditEntry?: (entry: RagEntry) => Promise<void>
  onDeleteEntry?: (id: string) => Promise<void>
  onOpenSourceSession?: (sessionId: string) => void
}

export const RagMemoryEntriesList: React.FC<RagMemoryEntriesListProps> = ({
  entries,
  searchQuery,
  activeMenuId,
  setActiveMenuId,
  formatDate,
  onEditEntry,
  onDeleteEntry,
  onOpenSourceSession
}) => (
  <div className={styles.entriesListContainer}>
    <RagEmbeddedFilesTable
      entries={entries}
      searchQuery={searchQuery}
      activeMenuId={activeMenuId}
      setActiveMenuId={setActiveMenuId}
      onEditEntry={onEditEntry}
      onDeleteEntry={onDeleteEntry}
      onOpenSourceSession={onOpenSourceSession}
      formatDate={formatDate}
    />
  </div>
)
