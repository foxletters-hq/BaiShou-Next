import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'
import { Modal, type SessionData } from '@baishou/ui'
import { AgentSessionList } from './AgentSessionList'
import styles from './AgentSessionsModal.module.css'

export interface AgentSessionsModalProps {
  isOpen: boolean
  assistantName?: string
  sessions: SessionData[]
  isLoading?: boolean
  selectedSessionId?: string
  searchQuery: string
  hasMore?: boolean
  isLoadingMore?: boolean
  scrollKey?: number
  onClose: () => void
  onSearchQueryChanged: (q: string) => void
  onLoadMore?: () => void
  onSessionSelected: (id: string) => void
  onPinSession?: (id: string) => void
  onDeleteSession?: (id: string) => void
  onRenameSession?: (id: string) => void
  onBatchDelete?: (ids: string[]) => void
}

export const AgentSessionsModal: React.FC<AgentSessionsModalProps> = ({
  isOpen,
  assistantName,
  sessions,
  isLoading = false,
  selectedSessionId,
  searchQuery,
  hasMore,
  isLoadingMore,
  scrollKey,
  onClose,
  onSearchQueryChanged,
  onLoadMore,
  onSessionSelected,
  onPinSession,
  onDeleteSession,
  onRenameSession,
  onBatchDelete
}) => {
  const { t } = useTranslation()
  const [isMultiSelect, setIsMultiSelect] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isOpen) {
      setIsMultiSelect(false)
      setSelectedIds(new Set())
    }
  }, [isOpen])

  const handleCheckChanged = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleBatchDelete = () => {
    if (selectedIds.size === 0 || !onBatchDelete) return
    onBatchDelete(Array.from(selectedIds))
    setIsMultiSelect(false)
    setSelectedIds(new Set())
  }

  const title = assistantName
    ? t('agent.sessions.modal_title_named', '{{name}} 的对话', { name: assistantName })
    : t('agent.sidebar.recent_chats', '最近对话')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick
      title={title}
      className={styles.modal}
      zIndex={1300}
    >
      <div className={styles.content}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder={t('agent.sidebar.search_hint', '搜索近期聊天...')}
              value={searchQuery}
              onChange={(e) => onSearchQueryChanged(e.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => onSearchQueryChanged('')}
                aria-label={t('common.clear', '清除')}
              >
                ✕
              </button>
            ) : null}
          </div>
          {sessions.length > 0 ? (
            <button
              type="button"
              className={`${styles.multiSelectBtn} ${isMultiSelect ? styles.multiSelectBtnActive : ''}`}
              title={t('common.multi_select', '多选')}
              aria-pressed={isMultiSelect}
              onClick={() => {
                setIsMultiSelect((prev) => !prev)
                setSelectedIds(new Set())
              }}
            >
              <ListChecks size={16} />
            </button>
          ) : null}
        </div>

        <div className={styles.listWrap}>
          <AgentSessionList
            sessions={sessions}
            isLoading={isLoading}
            searchQuery={searchQuery}
            selectedSessionId={selectedSessionId}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            scrollKey={scrollKey}
            isMultiSelect={isMultiSelect}
            selectedIds={selectedIds}
            onLoadMore={onLoadMore}
            onSessionSelected={(id) => {
              onSessionSelected(id)
              onClose()
            }}
            onCheckChanged={handleCheckChanged}
            onPinSession={onPinSession}
            onDeleteSession={onDeleteSession}
            onRenameSession={onRenameSession}
          />
        </div>

        {isMultiSelect && sessions.length > 0 ? (
          <div className={styles.batchBar}>
            <button
              type="button"
              className={styles.selectAllBtn}
              onClick={() => {
                if (selectedIds.size === sessions.length) setSelectedIds(new Set())
                else setSelectedIds(new Set(sessions.map((s) => s.id)))
              }}
            >
              {selectedIds.size === sessions.length
                ? t('agent.chat.cancel_select_all', '取消全选')
                : t('agent.chat.select_all', '全选')}
            </button>
            <div className={styles.spacer} />
            <button
              type="button"
              className={styles.batchDeleteBtn}
              disabled={selectedIds.size === 0}
              onClick={handleBatchDelete}
            >
              {t('common.delete', '删除')} ({selectedIds.size})
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
