import React from 'react'
import { useTranslation } from 'react-i18next'
import { Pagination } from '../Pagination/index'
import { PageSizeSelector } from '../PageSizeSelector'
import { RagEmbeddedFilesTable } from './RagEmbeddedFilesTable'
import type { RagEntry } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryEntriesListProps {
  entries: RagEntry[]
  searchQuery: string
  activeMenuId: string | null
  setActiveMenuId: (id: string | null) => void
  formatDate: (entry: RagEntry) => string
  showPagination: boolean
  effectiveTotal: number
  pageSize: number
  currentPage: number
  totalPages: number
  onEditEntry?: (entry: RagEntry) => Promise<void>
  onDeleteEntry?: (id: string) => Promise<void>
  onOpenSourceSession?: (sessionId: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export const RagMemoryEntriesList: React.FC<RagMemoryEntriesListProps> = ({
  entries,
  searchQuery,
  activeMenuId,
  setActiveMenuId,
  formatDate,
  showPagination,
  effectiveTotal,
  pageSize,
  currentPage,
  totalPages,
  onEditEntry,
  onDeleteEntry,
  onOpenSourceSession,
  onPageChange,
  onPageSizeChange
}) => {
  const { t } = useTranslation()

  return (
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
      {showPagination && (
        <div className={styles.paginationRow}>
          <div className={styles.paginationInfo}>
            {t('settings.rag_pagination_info', '共 $total 条').replace(
              '$total',
              String(effectiveTotal)
            )}
          </div>
          <div className={styles.paginationControls}>
            <PageSizeSelector
              value={pageSize}
              options={[10, 20, 30, 50, 100]}
              onChange={onPageSizeChange}
              label={t('settings.rag_per_page', '条/页')}
            />
            <Pagination
              current={currentPage}
              total={totalPages}
              onChange={onPageChange}
              siblingCount={1}
              showJumper={true}
              jumperPlaceholder={t('settings.rag_jump_to_page', '跳转')}
            />
          </div>
        </div>
      )}
    </div>
  )
}
