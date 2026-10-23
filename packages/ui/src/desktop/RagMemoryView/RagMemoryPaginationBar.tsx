import React from 'react'
import { useTranslation } from 'react-i18next'
import { Pagination } from '../Pagination/index'
import { PageSizeSelector } from '../PageSizeSelector'
import styles from './RagMemoryView.module.css'

interface RagMemoryPaginationBarProps {
  effectiveTotal: number
  pageSize: number
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export const RagMemoryPaginationBar: React.FC<RagMemoryPaginationBarProps> = ({
  effectiveTotal,
  pageSize,
  currentPage,
  totalPages,
  onPageChange,
  onPageSizeChange
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.paginationBar}>
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
  )
}
