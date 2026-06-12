import React from 'react'
import { useTranslation } from 'react-i18next'
import { Edit3 } from 'lucide-react'
import { DiaryCard } from '../DiaryCard'
import type { DiaryEntry } from '../DiaryCard'
import { PageSizeSelector, Pagination } from '@baishou/ui'

interface DiaryGridProps {
  scrollRef?: React.RefObject<HTMLDivElement | null>
  entries: DiaryEntry[]
  totalCount: number
  currentPage: number
  pageSize: number
  selectedMonth: Date | null
  loading: boolean
  attachmentBasePath: string
  onGoToEditor: (dateStr: string) => void
  onDeleteEntry: (id: number) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onViewAll: () => void
}

/** 格式化日期为 YYYY-MM-DD */
const formatDateStr = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 日记卡片网格视图，包含顶部/底部分页控制栏 */
export const DiaryGrid: React.FC<DiaryGridProps> = ({
  scrollRef,
  entries,
  totalCount,
  currentPage,
  pageSize,
  selectedMonth,
  loading,
  attachmentBasePath,
  onGoToEditor,
  onDeleteEntry,
  onPageChange,
  onPageSizeChange,
  onViewAll
}) => {
  const { t } = useTranslation()

  const showPagination = totalCount > pageSize
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginationInfo = t('diary.pagination_info', '共 $total 条，第 $page / $pages 页')
    .replace('$total', String(totalCount))
    .replace('$page', String(safeCurrentPage))
    .replace('$pages', String(totalPages))

  /** 分页控制栏（顶底复用） */
  const PaginationBar = () => (
    <>
      <div className="diary-pagination-info">{paginationInfo}</div>
      <div className="diary-pagination-controls">
        <PageSizeSelector
          value={pageSize}
          options={[20, 30, 50, 80, 100]}
          onChange={(size) => {
            onPageSizeChange(size)
            onPageChange(1)
          }}
          label={t('diary.per_page', '条/页')}
        />
        <Pagination
          current={safeCurrentPage}
          total={totalPages}
          onChange={onPageChange}
          siblingCount={1}
          showFirstLast={true}
          showJumper={true}
          jumperPlaceholder={t('common.pagination_jump_placeholder', 'Go to')}
        />
      </div>
    </>
  )

  if (loading && entries.length === 0) {
    return (
      <div className="diary-empty-state">
        <div className="diary-empty-text">{t('common.loading', '加载中...')}</div>
      </div>
    )
  }

  if (totalCount === 0) {
    return (
      <div className="diary-empty-state">
        <Edit3 size={56} className="diary-empty-icon" />
        <div className="diary-empty-text">
          {selectedMonth
            ? t('diary.no_diaries_month', '本月暂无日记')
            : t('diary.no_diaries', '暂无日记，开始记录吧')}
        </div>
        {selectedMonth && (
          <button className="diary-view-all-btn" onClick={onViewAll}>
            {t('common.view_all', '查看全部')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="diary-grid" ref={scrollRef}>
      {/* 顶部分页控制栏 */}
      {showPagination && (
        <div className="diary-pagination-top">
          <PaginationBar />
        </div>
      )}

      <div className="diary-grid-inner">
        {entries.map((entry) => (
          <div key={entry.id} style={{ height: '100%' }}>
            <DiaryCard
              entry={entry}
              onClick={() => onGoToEditor(formatDateStr(entry.date))}
              onEdit={() => onGoToEditor(formatDateStr(entry.date))}
              onDelete={() => onDeleteEntry(entry.id)}
              t={t as any}
              basePath={attachmentBasePath}
            />
          </div>
        ))}
      </div>

      {/* 底部分页控制栏 */}
      {showPagination && (
        <div className="diary-pagination">
          <PaginationBar />
        </div>
      )}
    </div>
  )
}
