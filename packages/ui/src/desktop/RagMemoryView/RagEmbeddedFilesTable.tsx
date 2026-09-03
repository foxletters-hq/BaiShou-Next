import React from 'react'
import { useTranslation } from 'react-i18next'
import { RagEntry } from './index'
import styles from './RagMemoryView.module.css'
import { EllipsisVertical, Library } from 'lucide-react'

interface RagEmbeddedFilesTableProps {
  entries: RagEntry[]
  searchQuery: string
  activeMenuId: string | null
  setActiveMenuId: (id: string | null) => void
  onEditEntry?: (entry: RagEntry) => void
  onDeleteEntry?: (id: string) => void
  onOpenSourceSession?: (sessionId: string) => void
  formatDate: (entry: RagEntry) => string
}

/**
 * 知识库已嵌入文档的表格列表/卡片瀑布流。
 */
export const RagEmbeddedFilesTable: React.FC<RagEmbeddedFilesTableProps> = ({
  entries,
  searchQuery,
  activeMenuId,
  setActiveMenuId,
  onEditEntry,
  onDeleteEntry,
  onOpenSourceSession,
  formatDate
}) => {
  const { t } = useTranslation()

  if (entries.length === 0) {
    return (
      <div className={styles.emptyStateContainer}>
        <div className={styles.emptyIconBig}>
          <Library size={48} />
        </div>
        <div className={styles.emptyTitleLarge}>
          {searchQuery
            ? t('common.no_search_result', '没有找到相关结果')
            : t('common.no_content', '暂无内容')}
        </div>
        <div className={styles.emptyDescSub}>
          {t(
            'settings.rag_empty_desc',
            '当 AI 阅读日记或生成内容时，底层向量数据将在这里自动生成并被管理。'
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.entriesWaterfall}>
      {entries.map((e) => (
        <div key={e.embeddingId} className={styles.memoryEntryCard}>
          <div className={styles.memoryEntryContentBlock}>
            <div className={styles.memoryEntryText}>{e.text}</div>
            <div className={styles.memoryEntryFooter}>
              {e.isManual && (
                <span className={styles.memoryMetaBadge}>
                  {t('settings.rag_source_manual', '手动')}
                </span>
              )}
              {!e.isManual &&
                e.sourceSessionId &&
                (onOpenSourceSession ? (
                  <button
                    type="button"
                    className={styles.memorySessionLink}
                    onClick={() => onOpenSourceSession(e.sourceSessionId!)}
                  >
                    {t('settings.rag_source_session', '来源会话')}
                  </button>
                ) : (
                  <span className={styles.memoryMetaBadge}>
                    {t('settings.rag_source_partner', '伙伴')}
                  </span>
                ))}
              {e.tags && e.tags.length > 0 && (
                <span className={styles.memoryTags}>
                  {e.tags.map((tag) => (
                    <span key={tag} className={styles.memoryTag}>
                      {tag}
                    </span>
                  ))}
                </span>
              )}
              <span>{formatDate(e)}</span>
              {e.memoryUpdatedAt != null && e.memoryUpdatedAt !== e.memoryCreatedAt && (
                <>
                  <span className={styles.metaSep}>·</span>
                  <span>
                    {t('settings.rag_updated_at', '修改')}{' '}
                    {formatDate({ ...e, createdAt: e.memoryUpdatedAt })}
                  </span>
                </>
              )}
              <span className={styles.metaSep}>·</span>
              <span className={styles.memoryEntryModel} title={e.modelId}>
                {e.modelId}
              </span>
              {e.similarity !== undefined && (
                <span className={styles.similarityTag}>
                  {t('recall.similarity', '相似度')} {Math.round(e.similarity * 100)}%
                </span>
              )}
            </div>
          </div>
          <div className={styles.memoryEntryActionsBlock}>
            <button
              type="button"
              className={styles.memoryMoreBtn}
              aria-label={t('common.more', '更多')}
              onClick={() => setActiveMenuId(activeMenuId === e.embeddingId ? null : e.embeddingId)}
            >
              <EllipsisVertical size={16} />
            </button>
            {activeMenuId === e.embeddingId && (
              <>
                <div className={styles.entryMenuBackdrop} onClick={() => setActiveMenuId(null)} />
                <div className={styles.entryMenu}>
                  <button
                    type="button"
                    className={styles.entryMenuItem}
                    onClick={() => {
                      setActiveMenuId(null)
                      onEditEntry?.(e)
                    }}
                  >
                    {t('common.edit', '编辑片段')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.entryMenuItem} ${styles.entryMenuItemDanger}`}
                    onClick={() => {
                      setActiveMenuId(null)
                      onDeleteEntry?.(e.embeddingId)
                    }}
                  >
                    {t('common.delete', '删除片段')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
