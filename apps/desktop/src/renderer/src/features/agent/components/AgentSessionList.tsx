import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareText } from 'lucide-react'
import { SessionListItem } from '@baishou/ui'
import type { SessionData } from '@baishou/ui'
import styles from './AgentSessionList.module.css'

interface AgentSessionListProps {
  sessions: SessionData[]
  isLoading: boolean
  searchQuery: string
  selectedSessionId?: string
  hasMore?: boolean
  isLoadingMore?: boolean
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

type SessionGroup = {
  key: string
  title: string
  items: SessionData[]
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function groupSessions(sessions: SessionData[], t: (key: string, fallback: string) => string): SessionGroup[] {
  const pinned: SessionData[] = []
  const today: SessionData[] = []
  const yesterday: SessionData[] = []
  const previous7: SessionData[] = []
  const older: SessionData[] = []

  const todayStart = startOfDay(new Date())
  const yesterdayStart = todayStart - 86_400_000
  const weekStart = todayStart - 7 * 86_400_000

  for (const session of sessions) {
    if (session.isPinned) {
      pinned.push(session)
      continue
    }
    const updatedAt = session.updatedAt
    if (!updatedAt || Number.isNaN(updatedAt)) {
      older.push(session)
      continue
    }
    if (updatedAt >= todayStart) today.push(session)
    else if (updatedAt >= yesterdayStart) yesterday.push(session)
    else if (updatedAt >= weekStart) previous7.push(session)
    else older.push(session)
  }

  const groups: SessionGroup[] = []
  if (pinned.length > 0) {
    groups.push({
      key: 'pinned',
      title: t('agent.sessions.groupPinned', '已置顶'),
      items: pinned
    })
  }
  if (today.length > 0) {
    groups.push({
      key: 'today',
      title: t('agent.sessions.groupToday', '今天'),
      items: today
    })
  }
  if (yesterday.length > 0) {
    groups.push({
      key: 'yesterday',
      title: t('agent.sessions.groupYesterday', '昨天'),
      items: yesterday
    })
  }
  if (previous7.length > 0) {
    groups.push({
      key: 'week',
      title: t('agent.sessions.groupWeek', '近 7 天'),
      items: previous7
    })
  }
  if (older.length > 0) {
    groups.push({
      key: 'older',
      title: t('agent.sessions.groupOlder', '更早'),
      items: older
    })
  }
  return groups
}

/**
 * 可滚动历史对话区：按时间分组 + 会话列表 + 加载更多。
 */
export const AgentSessionList: React.FC<AgentSessionListProps> = ({
  sessions,
  isLoading,
  searchQuery: _searchQuery,
  selectedSessionId,
  hasMore,
  isLoadingMore = false,
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
  const groups = useMemo(() => groupSessions(sessions, t), [sessions, t])

  React.useEffect(() => {
    if (scrollKey && scrollKey > 0 && scrollerRef.current) {
      scrollerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [scrollKey])

  return (
    <div className={styles.scroller} ref={scrollerRef}>
      {isLoading ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyText}>{t('common.loading', '加载中...')}</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className={styles.emptyState}>
          <MessageSquareText
            size={40}
            strokeWidth={1.25}
            className={styles.emptyIcon}
            aria-hidden
          />
          <span className={styles.emptyText}>
            {t('agent.sidebar.no_recent_chats', '暂无近期对话，快点开始一个吧~')}
          </span>
        </div>
      ) : (
        <div className={styles.list}>
          {groups.map((group) => (
            <section key={group.key} className={styles.group}>
              <div className={styles.groupHeader}>{group.title}</div>
              <div className={styles.groupItems}>
                {group.items.map((session) => (
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
              </div>
            </section>
          ))}
          {hasMore ? (
            <div className={styles.loadMoreWrap}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                disabled={isLoadingMore}
                onClick={() => onLoadMore?.()}
              >
                {isLoadingMore
                  ? t('common.loading', '加载中...')
                  : t('agent.sidebar.load_more', '加载更多对话')}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
