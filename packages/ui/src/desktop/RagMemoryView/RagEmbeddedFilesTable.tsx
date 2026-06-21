import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdAutoStories, MdMoreVert } from 'react-icons/md'
import { RagEntry } from './index'
import styles from './RagMemoryView.module.css'

interface RagEmbeddedFilesTableProps {
  entries: RagEntry[]
  searchQuery: string
  activeMenuId: string | null
  setActiveMenuId: (id: string | null) => void
  onEditEntry?: (entry: RagEntry) => void
  onDeleteEntry?: (id: string) => void
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
  formatDate
}) => {
  const { t } = useTranslation()

  if (entries.length === 0) {
    return (
      <div className={styles.emptyStateContainer}>
        <div className={styles.emptyIconBig}>
          <MdAutoStories size={64} />
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
          <div className={styles.memoryEntryIconBlock}>
            <span className={styles.memoryEntryBraces}>{`{}`}</span>
          </div>
          <div className={styles.memoryEntryContentBlock}>
            <div className={styles.memoryEntryText}>{e.text}</div>
            <div className={styles.memoryEntryFooter}>
              <span>{e.modelId}</span>
              <span>·</span>
              <span>{formatDate(e)}</span>
              {e.similarity !== undefined && (
                <>
                  <span>·</span>
                  <span className={styles.similarityTag}>
                    {t('recall.similarity', '相似度')}: {Math.round(e.similarity * 100)}%
                  </span>
                </>
              )}
            </div>
          </div>
          <div className={styles.memoryEntryActionsBlock} style={{ position: 'relative' }}>
            <button
              className={styles.memoryMoreBtn}
              onClick={() => setActiveMenuId(activeMenuId === e.embeddingId ? null : e.embeddingId)}
            >
              <MdMoreVert size={20} />
            </button>
            {activeMenuId === e.embeddingId && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 9 }}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    setActiveMenuId(null)
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 32,
                    background: 'var(--bg-color-primary, #fff)',
                    border: '1px solid var(--border-color, #eee)',
                    borderRadius: 6,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 10,
                    minWidth: 100,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--text-color, #333)',
                      transition: 'background 0.2s',
                      whiteSpace: 'nowrap',
                      position: 'relative',
                      zIndex: 11
                    }}
                    onMouseEnter={(ev) =>
                      (ev.currentTarget.style.background = 'var(--bg-color-secondary, #f5f5f5)')
                    }
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      setActiveMenuId(null)
                      onEditEntry && onEditEntry(e)
                    }}
                  >
                    {t('common.edit', '编辑片段')}
                  </div>
                  <div
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#ef4444',
                      transition: 'background 0.2s',
                      whiteSpace: 'nowrap',
                      position: 'relative',
                      zIndex: 11
                    }}
                    onMouseEnter={(ev) =>
                      (ev.currentTarget.style.background = 'var(--bg-color-secondary, #f5f5f5)')
                    }
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      setActiveMenuId(null)
                      onDeleteEntry && onDeleteEntry(e.embeddingId)
                    }}
                  >
                    {t('common.delete', '删除片段')}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
