import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdAutoAwesome } from 'react-icons/md'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { SessionData } from '@baishou/ui'
import { AgentSidebarHeader } from './AgentSidebarHeader'
import { AgentSessionList } from './AgentSessionList'
import styles from './AgentSidebar.module.css'

export interface AgentAssistant {
  id: string
  name: string
  description?: string
  avatarPath?: string
  emoji?: string
  assistantKind?: 'companion' | 'work'
}

export interface AgentSidebarProps {
  currentAssistant?: AgentAssistant
  sessions: SessionData[]
  isLoading?: boolean
  selectedSessionId?: string
  searchQuery?: string
  hasMore?: boolean
  isLoadingMore?: boolean
  scrollKey?: number
  pinnedAssistants?: AgentAssistant[]
  onSearchQueryChanged: (q: string) => void
  onLoadMore?: () => void
  onSessionSelected: (id: string) => void
  onNewSession: (assistantId?: string) => void
  onAssistantSwitched: (assistant: AgentAssistant) => void
  onPinSession?: (id: string) => void
  onDeleteSession?: (id: string) => void
  onRenameSession?: (id: string) => void
  onBatchDelete?: (ids: string[]) => void
  onCollapse?: () => void
  onShowPicker?: () => void
  isCollapsed?: boolean
  onExpand?: () => void
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  currentAssistant,
  sessions,
  isLoading = false,
  selectedSessionId,
  searchQuery = '',
  pinnedAssistants = [],
  onSearchQueryChanged,
  onSessionSelected,
  onNewSession,
  onAssistantSwitched,
  onPinSession,
  onDeleteSession,
  onRenameSession,
  onBatchDelete,
  onCollapse,
  onShowPicker,
  hasMore,
  isLoadingMore = false,
  scrollKey,
  onLoadMore,
  isCollapsed = false,
  onExpand
}) => {
  const { t } = useTranslation()
  const [isMultiSelect, setIsMultiSelect] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleCheckChanged = (id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    setSelectedIds(next)
  }

  const handleBatchDelete = () => {
    if (selectedIds.size > 0 && onBatchDelete) {
      onBatchDelete(Array.from(selectedIds))
      setIsMultiSelect(false)
      setSelectedIds(new Set())
    }
  }

  const toggleMultiSelect = () => {
    setIsMultiSelect((prev) => !prev)
    setSelectedIds(new Set())
  }

  return (
    <div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      {/* 品牌行独立于 sidebarContent，折叠时仍可见 */}
      <div className={styles.brandRow}>
        <div className={styles.brandInfo}>
          <div className={styles.brandIconBox}>
            <MdAutoAwesome className={styles.brandIcon} />
          </div>
          <span className={styles.brandText}>{t('agent.partner_label', '伙伴')}</span>
        </div>
        {onCollapse && onExpand && (
          <button
            className={styles.toggleBtn}
            onClick={isCollapsed ? onExpand : onCollapse}
            title={
              isCollapsed
                ? t('agent.sidebar.expand', '展开侧边栏')
                : t('agent.sidebar.collapse', '折叠侧边栏')
            }
          >
            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        )}
      </div>

      <div className={styles.sidebarContent}>
        {/* 顶部固定交互区 */}
        <div className={styles.fixedHeaderArea}>
          <AgentSidebarHeader
            currentAssistant={currentAssistant}
            pinnedAssistants={pinnedAssistants}
            searchQuery={searchQuery}
            hasSessions={sessions.length > 0}
            isMultiSelect={isMultiSelect}
            onSearchQueryChanged={onSearchQueryChanged}
            onNewSession={onNewSession}
            onAssistantSwitched={onAssistantSwitched}
            onShowPicker={onShowPicker}
            onToggleMultiSelect={toggleMultiSelect}
          />
        </div>

        <div style={{ height: 8, flexShrink: 0 }} />

        {/* 可滚动历史对话区 */}
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
          onSessionSelected={onSessionSelected}
          onCheckChanged={handleCheckChanged}
          onPinSession={onPinSession}
          onDeleteSession={onDeleteSession}
          onRenameSession={onRenameSession}
        />

        {/* ─── 固定底部区（批量删除操作栏） ─── */}
        <div className={styles.bottomArea}>
          {isMultiSelect && sessions.length > 0 && (
            <div className={styles.batchBar}>
              <button
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
              <div style={{ flex: 1 }} />
              <button
                className={styles.batchDeleteBtn}
                disabled={selectedIds.size === 0}
                onClick={handleBatchDelete}
              >
                {t('common.delete', '删除')} ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
