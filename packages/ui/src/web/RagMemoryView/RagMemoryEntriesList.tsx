import React from 'react'
import { useTranslation } from 'react-i18next'
import { Pagination } from '../Pagination/index'
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
            <select
              className={styles.pageSizeSelect}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {[10, 20, 30, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} {t('settings.rag_per_page', '条/页')}
                </option>
              ))}
            </select>
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
