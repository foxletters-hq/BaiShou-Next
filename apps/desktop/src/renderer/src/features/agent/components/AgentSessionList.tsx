import React from 'react'
import { useTranslation } from 'react-i18next'
import { SessionListItem } from '@baishou/ui'
import type { SessionData } from '@baishou/ui'
import styles from './AgentSidebar.module.css'

interface AgentSessionListProps {
  sessions: SessionData[]
  isLoading: boolean
  searchQuery: string
  selectedSessionId?: string
  hasMore?: boolean
  scrollKey?: number
  isMultiSelect: boolean
  selectedIds: Set<string>
  onLoadMore?: () => void
  onSessionSelected: (id: string) => void
  onCheckChanged: (id: string, checked: boolean) => void
  onPinSession?: (id: string) => void
  onDeleteSession?: (id: string) => void
  onRenameSession?: (id: string) => void
}

/**
 * 可滚动历史对话区：会话列表 + 加载更多按钮。
 */
export const AgentSessionList: React.FC<AgentSessionListProps> = ({
  sessions,
  isLoading,
  searchQuery,
  selectedSessionId,
  hasMore,
  scrollKey,
  isMultiSelect,
  selectedIds,
  onLoadMore,
  onSessionSelected,
  onCheckChanged,
  onPinSession,
  onDeleteSession,
  onRenameSession
}) => {
  const { t } = useTranslation()
  const scrollerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (scrollKey && scrollKey > 0 && scrollerRef.current) {
      scrollerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [scrollKey])

  const filteredSessions = sessions.filter(
    (session) => !searchQuery || session.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={styles.historyScroller} ref={scrollerRef}>
      <div className={styles.sessionList}>
        {isLoading ? (
          <div className={styles.emptyHint}>{t('common.loading', '加载中...')}</div>
        ) : sessions.length === 0 ? (
          <div className={styles.emptyHint}>
            {t('agent.sidebar.no_recent_chats', '暂无近期对话，快点开始一个吧~')}
          </div>
        ) : (
          <>
            {filteredSessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                isSelected={session.id === selectedSessionId}
                isMultiSelect={isMultiSelect}
                isChecked={selectedIds.has(session.id)}
                onTap={() => {
                  if (isMultiSelect) {
                    onCheckChanged(session.id, !selectedIds.has(session.id))
                  } else {
                    onSessionSelected(session.id)
                  }
                }}
                onPin={onPinSession ? () => onPinSession(session.id) : undefined}
                onRename={onRenameSession ? () => onRenameSession(session.id) : undefined}
                onDelete={onDeleteSession ? () => onDeleteSession(session.id) : undefined}
                onCheckChanged={(checked) => onCheckChanged(session.id, checked)}
              />
            ))}
            {hasMore && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '16px 0',
                  marginTop: '8px'
                }}
              >
                <button
                  onClick={onLoadMore}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: 0.8
                  }}
                >
                  {t('agent.sidebar.load_more', '加载更多对话')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ flex: 1 }} />
    </div>
  )
}
