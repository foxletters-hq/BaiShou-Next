import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from 'react-native'
import { Search } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { Input } from '../Input/Input'
import { Button } from '../Button/Button'
import type { AgentSession, AgentSessionListProps } from './agent-session-list.types'
export type { AgentSession, AgentSessionListProps } from './agent-session-list.types'
import {
  flattenGroupedSessions,
  groupSessionsByTime,
  type FlatSessionListRow,
  type TimeGroup
} from './agent-session-list.utils'
import { agentSessionListStyles as styles } from './agent-session-list.styles'
import { AgentSessionListItem } from './AgentSessionListItem'
import { AgentSessionActionSheet } from './AgentSessionActionSheet'

export const AgentSessionList: React.FC<AgentSessionListProps> = ({
  sessions,
  onSelect,
  onPin,
  onDelete,
  onRename,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  searchQuery: controlledSearchQuery,
  onSearchQueryChange,
  isRefreshing = false,
  onRefresh,
  scrollKey = 0
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const [actionSession, setActionSession] = useState<AgentSession | null>(null)
  const listRef = useRef<FlatList<FlatSessionListRow>>(null)

  const isControlledSearch = typeof onSearchQueryChange === 'function'
  const searchQuery = isControlledSearch ? (controlledSearchQuery ?? '') : internalSearchQuery
  const handleSearchChange = useCallback(
    (nextQuery: string) => {
      if (isControlledSearch) {
        onSearchQueryChange(nextQuery)
      } else {
        setInternalSearchQuery(nextQuery)
      }
    },
    [isControlledSearch, onSearchQueryChange]
  )

  useEffect(() => {
    if (scrollKey > 0) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false })
    }
  }, [scrollKey])

  const groupLabel = useCallback(
    (group: TimeGroup) => {
      const labels: Record<TimeGroup, string> = {
        pinned: t('agent.sessions.groupPinned', '已置顶'),
        today: t('agent.sessions.groupToday', '今天'),
        yesterday: t('agent.sessions.groupYesterday', '昨天'),
        thisWeek: t('agent.sessions.groupWeek', '近 7 天'),
        earlier: t('agent.sessions.groupOlder', '更早')
      }
      return labels[group]
    },
    [t]
  )

  const filteredSessions = useMemo(() => {
    // 受控搜索下由外部查询数据库（同时覆盖标题与消息正文），前端不再仅按标题二次截断
    if (isControlledSearch || !searchQuery.trim()) return sessions
    const query = searchQuery.toLowerCase()
    return sessions.filter(
      (s) =>
        (s.title ?? '').toLowerCase().includes(query) ||
        (s.snippet ?? '').toLowerCase().includes(query)
    )
  }, [sessions, searchQuery, isControlledSearch])

  const groupedSessions = useMemo(
    () => groupSessionsByTime(filteredSessions, groupLabel),
    [filteredSessions, groupLabel]
  )

  const flatRows = useMemo(() => flattenGroupedSessions(groupedSessions), [groupedSessions])

  const handleEndReached = useCallback(() => {
    if (!hasMore || isLoadingMore || !onLoadMore) return
    onLoadMore()
  }, [hasMore, isLoadingMore, onLoadMore])

  const handleScrollNearBottom = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasMore || isLoadingMore || !onLoadMore) return
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
      if (contentOffset.y <= 0 || contentSize.height <= 0 || layoutMeasurement.height <= 0) return
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y
      const threshold = Math.max(120, layoutMeasurement.height * 0.25)
      if (distanceFromBottom <= threshold) {
        onLoadMore()
      }
    },
    [hasMore, isLoadingMore, onLoadMore]
  )

  const listFooter = useMemo(() => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      )
    }
    if (hasMore && onLoadMore) {
      return (
        <View style={styles.footerLoadMore}>
          <Button variant="outlined" size="sm" onPress={onLoadMore}>
            {t('agent.sessions.loadMore', '加载更多对话')}
          </Button>
        </View>
      )
    }
    return null
  }, [isLoadingMore, hasMore, onLoadMore, colors.textSecondary, t])

  const handleShowActions = useCallback((session: AgentSession) => {
    setActionSession(session)
  }, [])

  const renderRow = useCallback(
    ({ item: row }: { item: FlatSessionListRow }) => {
      if (row.type === 'header') {
        return (
          <View style={[styles.groupHeader, { backgroundColor: colors.bgApp }]}>
            <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>{row.label}</Text>
          </View>
        )
      }
      return (
        <AgentSessionListItem
          item={row.session}
          onSelect={onSelect}
          onShowActions={handleShowActions}
        />
      )
    },
    [colors.bgApp, colors.textSecondary, onSelect, handleShowActions]
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <View style={styles.searchBar}>
        <Input
          placeholder={t('agent.sidebar.search_hint', '搜索对话标题或内容...')}
          value={searchQuery}
          onChangeText={handleSearchChange}
          className="rounded-full min-h-10"
          style={styles.searchInput}
          leftSlot={
            <Search size={18} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          }
          rightSlot={
            searchQuery.length > 0 ? (
              <Pressable onPress={() => handleSearchChange('')} hitSlop={8}>
                <Text style={[styles.clearIcon, { color: colors.textSecondary }]}>×</Text>
              </Pressable>
            ) : undefined
          }
        />
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={flatRows}
        scrollEnabled={!actionSession}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('agent.sessions.empty', '暂无会话记录...')}
            </Text>
          </View>
        }
        ListFooterComponent={listFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        onScroll={handleScrollNearBottom}
        onScrollEndDrag={handleScrollNearBottom}
        onMomentumScrollEnd={handleScrollNearBottom}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

      <AgentSessionActionSheet
        session={actionSession}
        onClose={() => setActionSession(null)}
        onPin={onPin}
        onDelete={onDelete}
        onRename={onRename}
      />
    </View>
  )
}
