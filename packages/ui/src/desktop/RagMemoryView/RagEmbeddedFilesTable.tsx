import i18n from 'i18next'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  buildRagEntryListPreview,
  isGraphNodeRagEntry,
  isRagEntryEditable,
  ragVectorKindLabelKey,
  resolveRagMemoryEmptyCopy,
  resolveRagVectorKind,
  type RagVectorKind,
  type RagVectorKindFilter
} from '@baishou/shared'
import { RagEntry } from './index'
import { RagMemoryEntryPreviewModal } from './RagMemoryEntryPreviewModal'
import { RagMemoryHighlightedText } from './RagMemoryHighlightedText'
import styles from './RagMemoryView.module.css'
import { Button } from '../Button/Button'
import { EllipsisVertical, Library } from 'lucide-react'

interface RagEmbeddedFilesTableProps {
  entries: RagEntry[]
  searchQuery: string
  sourceKind?: RagVectorKindFilter
  activeMenuId: string | null
  setActiveMenuId: (id: string | null) => void
  onEditEntry?: (entry: RagEntry) => void
  onDeleteEntry?: (id: string) => void
  formatDate: (entry: RagEntry) => string
}

const KIND_BADGE_CLASS: Record<RagVectorKind, string> = {
  diary: styles.kindBadgeDiary,
  partner: styles.kindBadgePartner,
  manual: styles.kindBadgeManual,
  graph_node: styles.kindBadgeGraph
}

const KIND_FALLBACK: Record<RagVectorKind, string> = {
  diary: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagEmbeddedFilesTable.L38', '日记'),
  partner: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagEmbeddedFilesTable.L39', '伙伴'),
  manual: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagEmbeddedFilesTable.L40', '手动'),
  graph_node: i18n.t('auto.packages.ui.src.desktop.RagMemoryView.RagEmbeddedFilesTable.L41', '节点')
}

/**
 * 知识库已嵌入文档的表格列表/卡片瀑布流。
 */
export const RagEmbeddedFilesTable: React.FC<RagEmbeddedFilesTableProps> = ({
  entries,
  searchQuery,
  sourceKind = 'all',
  activeMenuId,
  setActiveMenuId,
  onEditEntry,
  onDeleteEntry,
  formatDate
}) => {
  const { t } = useTranslation()
  const [previewEntry, setPreviewEntry] = useState<RagEntry | null>(null)
  const keyword = searchQuery.trim()

  if (entries.length === 0) {
    const emptyCopy = resolveRagMemoryEmptyCopy({ searchQuery, sourceKind })
    return (
      <div className={styles.emptyStateContainer}>
        <div className={styles.emptyIconBig}>
          <Library size={48} />
        </div>
        <div className={styles.emptyTitleLarge}>
          {t(emptyCopy.titleKey, emptyCopy.titleFallback)}
        </div>
        <div className={styles.emptyDescSub}>{t(emptyCopy.descKey, emptyCopy.descFallback)}</div>
      </div>
    )
  }

  return (
    <div className={styles.entriesWaterfall}>
      {entries.map((e) => {
        const kind = resolveRagVectorKind(e)
        const isGraphNode = isGraphNodeRagEntry(e.sourceType)
        const { preview } = buildRagEntryListPreview(e.text, keyword || undefined)
        return (
          <div key={e.embeddingId} className={styles.memoryEntryCard}>
            <div className={styles.memoryEntryContentBlock}>
              {kind ? (
                <div className={styles.memoryEntryKindRow}>
                  <span className={`${styles.kindBadge} ${KIND_BADGE_CLASS[kind]}`}>
                    {t(ragVectorKindLabelKey(kind), KIND_FALLBACK[kind])}
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                className={styles.memoryEntryText}
                aria-label={t('settings.rag_view_entry', '查看完整片段')}
                onClick={() => setPreviewEntry(e)}
              >
                <span className={styles.memoryEntryTextInner}>
                  <RagMemoryHighlightedText text={preview} keyword={keyword || undefined} />
                </span>
              </button>
              <Button type="button" variant="outlined" size="small" onClick={() => setPreviewEntry(e)}>
                {t('settings.rag_view_entry', '查看完整片段')}
              </Button>
              <div className={styles.memoryEntryFooter}>
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
                onClick={() =>
                  setActiveMenuId(activeMenuId === e.embeddingId ? null : e.embeddingId)
                }
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
                        setPreviewEntry(e)
                      }}
                    >
                      {t('settings.rag_view_entry', '查看完整片段')}
                    </button>
                    {isRagEntryEditable(e.sourceType) && (
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
                    )}
                    <button
                      type="button"
                      className={`${styles.entryMenuItem} ${styles.entryMenuItemDanger}`}
                      onClick={() => {
                        setActiveMenuId(null)
                        onDeleteEntry?.(e.embeddingId)
                      }}
                    >
                      {isGraphNode
                        ? t('settings.rag_clear_node_embed', '清除节点向量')
                        : t('common.delete', '删除片段')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })}
      <RagMemoryEntryPreviewModal
        open={previewEntry != null}
        text={previewEntry?.text ?? ''}
        keyword={keyword || undefined}
        onClose={() => setPreviewEntry(null)}
      />
    </div>
  )
}
