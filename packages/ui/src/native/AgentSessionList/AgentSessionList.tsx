import React, { useState, useMemo } from 'react'
import { View, Text, Pressable, FlatList } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Input } from '../Input/Input'
import type { AgentSessionListProps } from './agent-session-list.types'
export type { AgentSession, AgentSessionListProps } from './agent-session-list.types'
import { groupSessionsByTime, type TimeGroup } from './agent-session-list.utils'
import { agentSessionListStyles as styles } from './agent-session-list.styles'
import { AgentSessionListItem } from './AgentSessionListItem'

export const AgentSessionList: React.FC<AgentSessionListProps> = ({
  sessions,
  onSelect,
  onPin,
  onDelete,
  onRename
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [searchQuery, setSearchQuery] = useState('')

  const groupLabel = (group: TimeGroup) => {
    const labels: Record<TimeGroup, string> = {
      pinned: t('agent.sessions.groupPinned', '已置顶'),
      today: t('agent.sessions.groupToday', '今天'),
      yesterday: t('agent.sessions.groupYesterday', '昨天'),
      thisWeek: t('agent.sessions.groupWeek', '近 7 天'),
      earlier: t('agent.sessions.groupOlder', '更早')
    }
    return labels[group]
  }

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const query = searchQuery.toLowerCase()
    return sessions.filter((s) => (s.title ?? '').toLowerCase().includes(query))
  }, [sessions, searchQuery])

  const groupedSessions = useMemo(
    () => groupSessionsByTime(filteredSessions, groupLabel),
    [filteredSessions, t]
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSurface }]}>
      <View style={styles.searchBar}>
        <Input
          placeholder={t('agent.sidebar.search_hint', '搜索近期聊天...')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="rounded-full min-h-10"
          style={styles.searchInput}
          leftSlot={<MaterialIcons name="search" size={18} color={colors.textTertiary} />}
          rightSlot={
            searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Text style={[styles.clearIcon, { color: colors.textSecondary }]}>×</Text>
              </Pressable>
            ) : undefined
          }
        />
      </View>

      <FlatList
        data={groupedSessions}
        keyExtractor={(item) => item.group}
        renderItem={({ item: group }) => (
          <View>
            <View style={[styles.groupHeader, { backgroundColor: colors.bgApp }]}>
              <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
                {group.label}
              </Text>
            </View>
            {group.items.map((session) => (
              <AgentSessionListItem
                key={session.id}
                item={session}
                onSelect={onSelect}
                onPin={onPin}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('agent.sessions.empty', '暂无会话记录...')}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}
