import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { Plus, Sparkles, Trash2, Search } from 'lucide-react'
import styles from './AssistantManagementPage.module.css'
import { AssistantListRow, AssistantSortableListItem } from './AssistantSortableListItem'
import { useAssistantManagementPage } from './useAssistantManagementPage'

export interface AssistantInfo {
  id: string
  name: string
  emoji: string
  description?: string
  systemPrompt: string
  contextWindow: number
  providerId?: string
  modelId?: string
  compressTokenThreshold: number
  createdAt?: number
  lastUsedAt?: number
  useCount?: number
  avatarPath?: string
  assistantKind?: 'companion' | 'work'
  sortOrder?: number
}

export interface AssistantManagementPageProps {
  assistants: AssistantInfo[]
  pinnedIds: Set<string>
  onEdit: (assistant: AssistantInfo) => void
  onCreate: () => void
  onDelete: (assistantId: string) => void
  onClone?: (assistant: AssistantInfo) => void
  onTogglePin: (assistantId: string) => void
  onReorder?: (orderedIds: string[]) => void
}

export const AssistantManagementPage: React.FC<AssistantManagementPageProps> = ({
  assistants,
  pinnedIds,
  onEdit,
  onCreate,
  onDelete,
  onReorder
}) => {
  const { t } = useTranslation()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const vm = useAssistantManagementPage(assistants, pinnedIds, searchQuery, onReorder)

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      onDelete(deleteTargetId)
      setDeleteTargetId(null)
    }
  }

  useEffect(() => {
    if (deleteTargetId === null || typeof document === 'undefined') return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [deleteTargetId])

  const renderRow = (assistant: AssistantInfo) => (
    <AssistantSortableListItem
      key={assistant.id}
      assistant={assistant}
      isPinned={pinnedIds.has(assistant.id)}
      onEdit={onEdit}
      onDelete={setDeleteTargetId}
    />
  )

  return (
    <div className={styles.page}>
      <div className={styles.appBar}>
        <div className={styles.appBarTitle}>{t('agent.assistant.title', '伙伴管理')}</div>
        <div className={styles.appBarControls}>
          {assistants.length > 0 ? (
            <div className={styles.searchBox}>
              <Search size={16} color="var(--text-tertiary)" />
              <input
                className={styles.searchInput}
                placeholder={t('agent.assistant.search_hint')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          ) : null}
          <button className={styles.createBtn} onClick={onCreate}>
            <Plus size={18} />
            {t('agent.assistant.create_new', '新增伙伴')}
          </button>
        </div>
      </div>

      <div className={styles.scrollArea}>
        {assistants.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Sparkles size={72} strokeWidth={1} />
            </div>
            <span className={styles.emptyText}>
              {t('agent.assistant.empty_hint', '全列阵空爆：您的矩阵里还没有服役的心智')}
            </span>
            <button className={styles.emptyBtn} onClick={onCreate}>
              <Plus size={18} />
              {t('agent.assistant.create_first', '执行首建协议')}
            </button>
          </div>
        ) : vm.visibleAssistants.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyText}>{t('common.no_data')}</span>
          </div>
        ) : vm.isDragEnabled ? (
          <DndContext
            sensors={vm.sensors}
            collisionDetection={closestCenter}
            onDragStart={vm.handleDragStart}
            onDragEnd={vm.handleDragEnd}
            modifiers={[restrictToWindowEdges]}
          >
            <SortableContext
              items={vm.visibleAssistants.map((a) => a.id)}
              strategy={rectSortingStrategy}
            >
              <div className={styles.sortableList}>
                {vm.visibleAssistants.map((assistant) => renderRow(assistant))}
              </div>
            </SortableContext>
            {typeof document !== 'undefined'
              ? createPortal(
                  <DragOverlay
                    dropAnimation={{
                      sideEffects: defaultDropAnimationSideEffects({
                        styles: { active: { opacity: '0.5' } }
                      })
                    }}
                  >
                    {vm.activeDragId
                      ? (() => {
                          const assistant = vm.visibleAssistants.find(
                            (a) => a.id === vm.activeDragId
                          )
                          if (!assistant) return null
                          const isPinned = pinnedIds.has(assistant.id)
                          return (
                            <AssistantListRow
                              style={
                                vm.dragOverlayWidth ? { width: vm.dragOverlayWidth } : undefined
                              }
                              className={`${styles.sortableRow} ${styles.sortableRowDragging} ${isPinned ? styles.cardPinned : ''}`}
                              assistant={assistant}
                              isPinned={isPinned}
                            />
                          )
                        })()
                      : null}
                  </DragOverlay>,
                  document.body
                )
              : null}
          </DndContext>
        ) : (
          <div className={styles.sortableList}>
            {vm.visibleAssistants.map((assistant) => renderRow(assistant))}
          </div>
        )}
      </div>

      {deleteTargetId !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={styles.dialogOverlay} onClick={() => setDeleteTargetId(null)}>
            <div className={styles.dialogBox} onClick={(e) => e.stopPropagation()}>
              <div className={styles.dialogHeaderIcon}>
                <Trash2 size={32} color="var(--color-error, #F44336)" />
              </div>
              <div className={styles.dialogTitle}>
                {t('agent.assistant.delete_confirm_title', '特级警告：抹除心智模式？')}
              </div>
              <div className={styles.dialogText}>
                {t(
                  'agent.assistant.delete_confirm_content',
                  '确认要永久销毁此智能体的全部数据吗？一旦抹除将不可撤销。'
                )}
              </div>
              <div className={styles.dialogActions}>
                <button
                  className={`${styles.dialogBtn} ${styles.dialogBtnCancel}`}
                  onClick={() => setDeleteTargetId(null)}
                >
                  {t('common.cancel', '暂缓')}
                </button>
                <button
                  className={`${styles.dialogBtn} ${styles.dialogBtnDanger}`}
                  onClick={handleConfirmDelete}
                >
                  {t('common.delete', '授权粉碎')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
